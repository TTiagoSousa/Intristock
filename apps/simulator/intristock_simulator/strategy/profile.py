"""O perfil de volume por sessão (o "SVP HD" da `trading-chart`), com as mesmas
contas da biblioteca: as sessões saem das horas da bolsa (cada parte à parte,
todas juntas, só uma, ou um horário à escolha), o volume de cada vela reparte-se
pelas linhas de preço que ela atravessa (por igual ao longo da vela), o POC é a
linha com mais volume e a área de valor cresce a partir dele para o lado com
mais volume até à % pedida.

Em cada vela, na abertura dela, sabe-se:
- o perfil de cada sessão já acabada (a última, ou N para trás);
- o perfil da sessão em curso até à última vela fechada (em desenvolvimento):
  as linhas são as das velas que já houve, porque as da sessão inteira só se
  sabem no fim;
- o nível virgem: o da última sessão acabada em que nenhuma vela tocou depois
  (como as linhas prolongadas da biblioteca, que param quando uma vela lhes toca).

Os níveis são preços (POC, VAH, VAL); o delta (volume de alta − de baixa, em %
do total) e o volume da linha onde está o fecho (em % da do POC) não são.
"""

from datetime import datetime, timezone
from zoneinfo import ZoneInfo, ZoneInfoNotFoundError

import numpy as np

DAY_MS = 86_400_000
HOUR_MS = 3_600_000
MINUTE_MS = 60_000

# As sessões do indicador, como na biblioteca (`SVP_SESSIONS`)
PROFILE_SESSIONS = ("each", "all", "pre", "regular", "post", "overnight", "custom")
PROFILE_LEVELS = ("poc", "vah", "val", "delta", "rowVolume")
PRICE_LEVELS = ("poc", "vah", "val")
PROFILE_SOURCES = ("developing", "session", "naked")
# O máximo de linhas com os ticks por linha (`MAX_ROWS` da biblioteca)
MAX_ROWS = 2000
# As partes do dia pela ordem em que a biblioteca as procura
PARTS = ("regular", "pre", "post", "overnight")

# As bolsas da biblioteca (`EXCHANGE_SESSIONS`): o fuso e as horas de cada parte
EXCHANGES = {
    "NYSE": ("America/New_York", {"overnight": "2000-0400", "pre": "0400-0930", "regular": "0930-1600",
                                  "post": "1600-2000"}),
    "CME": ("America/Chicago", {"overnight": "1700-0830", "regular": "0830-1500", "post": "1500-1600"}),
    "B3": ("America/Sao_Paulo", {"pre": "0945-1000", "regular": "1000-1755", "post": "1755-1800"}),
    "EURONEXT": ("Europe/Paris", {"pre": "0715-0900", "regular": "0900-1730", "post": "1730-1740"}),
    "XETRA": ("Europe/Berlin", {"pre": "0800-0900", "regular": "0900-1730", "post": "1730-2200"}),
    "LSE": ("Europe/London", {"pre": "0750-0800", "regular": "0800-1630", "post": "1630-1635"}),
    "TSE": ("Asia/Tokyo", {"regular": "0900-1130,1230-1530"}),
    "HKEX": ("Asia/Hong_Kong", {"pre": "0900-0930", "regular": "0930-1200,1300-1600", "post": "1600-1610"}),
    "FOREX": ("America/New_York", {"regular": "1700-1700"}),
    "CRYPTO": ("UTC", {"regular": "0000-2400"}),
}
# "A do símbolo": os mercados do IntriStock são todos de cripto (a Binance e a Coinbase)
SYMBOL_EXCHANGE = "CRYPTO"

# Os perfis já feitos (as ~85 variantes do relatório usam as mesmas velas)
_CACHE: dict = {}
_CACHE_SIZE = 16


def parse_ranges(text: str) -> list[tuple[int, int]] | None:
    """'0930-1600' ou '0900-1130,1230-1530' → minutos do dia; None se não se lê."""
    out = []
    for part in str(text or "").split(","):
        part = part.strip().replace(":", "")
        if len(part) != 9 or part[4] != "-" or not (part[:4] + part[5:]).isdigit():
            return None
        a = int(part[:2]) * 60 + int(part[2:4])
        b = int(part[5:7]) * 60 + int(part[7:9])
        if int(part[2:4]) > 59 or int(part[7:9]) > 59 or a > 1439 or b > 1440:
            return None
        out.append((a, b))
    return out or None


def _offsets(zone_name: str, times: np.ndarray) -> np.ndarray:
    """A diferença para UTC (ms) de cada instante no fuso, hora a hora."""
    if zone_name == "UTC" or not len(times):
        return np.zeros(len(times), np.int64)
    try:
        zone = ZoneInfo(zone_name)
    except (ZoneInfoNotFoundError, ValueError):
        return np.zeros(len(times), np.int64)
    first = int(times[0]) // HOUR_MS
    hours = range(first, int(times[-1]) // HOUR_MS + 1)
    table = np.array(
        [int(datetime.fromtimestamp(hour * 3600, timezone.utc).astimezone(zone).utcoffset().total_seconds() * 1000)
         for hour in hours],
        np.int64,
    )
    return table[times // HOUR_MS - first]


def _filter(operand: dict) -> tuple[str, list[tuple[str, list[tuple[int, int]]]], bool]:
    """As partes em que se dividem as velas (`filter` da biblioteca): o fuso, as
    partes com os minutos de cada uma e se se juntam (`all`)."""
    exchange = str(operand.get("exchange") or "") or SYMBOL_EXCHANGE
    zone, hours = EXCHANGES.get(exchange, EXCHANGES[SYMBOL_EXCHANGE])
    session = operand.get("session") or "each"
    if session == "custom":
        return zone, [("custom", parse_ranges(operand.get("customSession") or "") or [])], False
    parts = []
    for part in PARTS:
        if session not in ("each", "all") and session != part:
            continue
        ranges = parse_ranges(hours[part]) if hours.get(part) else None
        if ranges:
            parts.append((part, ranges))
    return zone, parts, session == "all"


def _spans(times: np.ndarray, tf_ms: int, operand: dict) -> tuple[np.ndarray, np.ndarray]:
    """As sessões (`splitSessions`): velas seguidas na mesma parte do mesmo dia de
    negociação; as que caem fora das partes ficam de fora. Nas diárias e maiores,
    cada vela é uma sessão. Devolve o início e o fim (índices) de cada uma."""
    n = len(times)
    if not n:
        empty = np.empty(0, np.int64)
        return empty, empty
    zone, parts, merge = _filter(operand)
    seconds = times // 1000
    if tf_ms >= DAY_MS:
        key = (seconds + 43_200) // 86_400
        inside = np.ones(n, bool)
    else:
        wall = seconds + _offsets(zone, times) // 1000
        day = wall // 86_400
        minute = (wall - day * 86_400) // 60
        part_of = np.full(n, -1, np.int64)
        nxt = np.zeros(n, bool)
        for k, (_, ranges) in enumerate(parts):
            for start, end in ranges:
                free = part_of < 0
                if start < end:
                    hit = free & (minute >= start) & (minute < end)
                    part_of[hit] = k
                else:
                    late = free & (minute >= start)
                    part_of[late] = k
                    nxt[late] = start > 0
                    early = (part_of < 0) & (minute < end)
                    part_of[early] = k
        inside = part_of >= 0
        key = (day + nxt) * 8 + (0 if merge else part_of)
    starts = inside & np.r_[True, (key[1:] != key[:-1]) | ~inside[:-1]]
    first = np.flatnonzero(starts)
    # O fim: a vela antes do início seguinte ou da primeira de fora
    last = np.empty(len(first), np.int64)
    outside = np.flatnonzero(~inside)
    for i, a in enumerate(first):
        b = first[i + 1] - 1 if i + 1 < len(first) else n - 1
        cut = np.searchsorted(outside, a)
        if cut < len(outside) and outside[cut] <= b:
            b = outside[cut] - 1
        last[i] = b
    return first.astype(np.int64), last


def _grid(low: float, high: float, operand: dict) -> tuple[float, float, int] | None:
    """As linhas do perfil (`computeVolumeProfile`): o fundo, a altura e quantas."""
    if not (np.isfinite(low) and np.isfinite(high)):
        return None
    rows = max(1, int(round(float(operand.get("rowSize") or 24))))
    if operand.get("rowsLayout") == "ticks":
        step = rows * float(operand.get("tickSize") or 0.01)
        lo = np.floor(low / step + 1e-9) * step
        count = max(1, int(np.ceil((high - lo) / step - 1e-9)))
        if lo + count * step <= high:
            count += 1
        if count > MAX_ROWS:
            count = MAX_ROWS
            step = (high - lo) / count
        return lo, step, count
    if not high > low:
        return None
    return low, (high - low) / rows, rows


def _spread(lo: float, step: float, count: int, low, high, close, volume, up) -> tuple[np.ndarray, np.ndarray]:
    """O volume de alta e de baixa de cada linha (`spread`): cada vela reparte o
    dela pelas linhas que atravessa, pela parte de cada uma que ela cobre."""
    edges = lo + np.arange(count + 1) * step
    rows_up = np.zeros(count)
    rows_down = np.zeros(count)
    span = high - low
    flat = span <= 0
    if flat.any():
        row = np.clip(np.floor((close[flat] - lo) / step), 0, count - 1).astype(np.int64)
        np.add.at(rows_up, row[up[flat]], volume[flat][up[flat]])
        np.add.at(rows_down, row[~up[flat]], volume[flat][~up[flat]])
    wide = ~flat
    if wide.any():
        w_low, w_high, w_span, w_volume = low[wide], high[wide], span[wide], volume[wide]
        # A parte de cada linha coberta pela vela: min(máxima, topo) − max(mínima, fundo)
        cover = np.clip(np.minimum(w_high[:, None], edges[None, 1:]) - np.maximum(w_low[:, None], edges[None, :-1]),
                        0, None)
        share = cover * (w_volume / w_span)[:, None]
        w_up = up[wide]
        rows_up += share[w_up].sum(axis=0)
        rows_down += share[~w_up].sum(axis=0)
    return rows_up, rows_down


def _value_area(total: list[float], va_pct: float) -> tuple[int, int, int]:
    """O POC e a área de valor (`valueArea`): a partir do POC, junta-se a linha de
    cima ou a de baixo, a que tiver mais volume, até chegar à %."""
    n = len(total)
    poc, peak, whole = 0, 0.0, 0.0
    for i, value in enumerate(total):
        whole += value
        if value > peak:
            peak, poc = value, i
    low = high = poc
    acc = peak
    while acc < whole * va_pct and (low > 0 or high < n - 1):
        below = total[low - 1] if low > 0 else -1.0
        above = total[high + 1] if high < n - 1 else -1.0
        if above >= below:
            high += 1
            acc += above
        else:
            low -= 1
            acc += below
    return poc, low, high


class _Profile:
    """Um perfil: as linhas, o volume de alta e de baixa de cada uma, o POC e a área de valor."""

    __slots__ = ("lo", "step", "count", "up", "down", "poc", "va_low", "va_high")

    def __init__(self, lo, step, count, up, down, va_pct):
        self.lo, self.step, self.count, self.up, self.down = lo, step, count, up, down
        self.poc, self.va_low, self.va_high = _value_area((up + down).tolist(), va_pct)

    def levels(self) -> tuple[float, float, float]:
        """POC (meio da linha), VAH (topo da área de valor) e VAL (fundo)."""
        return (
            self.lo + (self.poc + 0.5) * self.step,
            self.lo + (self.va_high + 1) * self.step,
            self.lo + self.va_low * self.step,
        )

    def delta(self) -> float:
        up, down = float(self.up.sum()), float(self.down.sum())
        return (up - down) / (up + down) * 100 if up + down > 0 else np.nan

    def row_volume(self, price: float) -> float:
        """O volume da linha onde está o preço, em % do da linha do POC (fora do perfil, 0)."""
        if not np.isfinite(price):
            return np.nan
        row = int(np.floor((price - self.lo) / self.step))
        total = self.up + self.down
        peak = total[self.poc]
        if row < 0 or row >= self.count or peak <= 0:
            return 0.0
        return float(total[row] / peak * 100)


def _profile(bars, a: int, b: int, operand: dict, va_pct: float) -> _Profile | None:
    """O perfil das velas a..b (inclusive)."""
    low, high = bars.low[a:b + 1], bars.high[a:b + 1]
    grid = _grid(float(low.min()), float(high.max()), operand)
    if grid is None:
        return None
    close, open_ = bars.close[a:b + 1], bars.open[a:b + 1]
    up, down = _spread(*grid, low, high, close, bars.volume[a:b + 1].astype(float), close >= open_)
    return _Profile(*grid, up, down, va_pct)


def _values(profile: _Profile | None, price: float) -> tuple[float, ...]:
    if profile is None:
        return (np.nan,) * 5
    return (*profile.levels(), profile.delta(), profile.row_volume(price))


def _key(bars, tf_ms: int, operand: dict) -> tuple:
    keys = ("session", "customSession", "exchange", "rowsLayout", "rowSize", "tickSize", "vaPct")
    return (id(bars.time), len(bars), tf_ms, *(str(operand.get(key) or "") for key in keys))


def _compute(bars, tf_ms: int, operand: dict) -> dict:
    """Todos os valores do perfil em cada vela, como se sabem na abertura dela:
    {(fonte, nível): série}, com a sessão N para trás em ("session", N)."""
    n = len(bars)
    va_pct = min(100.0, max(1.0, float(operand.get("vaPct") or 70))) / 100
    first, last = _spans(np.asarray(bars.time, np.int64), tf_ms, operand)

    # As sessões acabadas: um perfil cada uma
    finished = [_profile(bars, int(a), int(b), operand, va_pct) for a, b in zip(first, last)]
    finished_values = np.array(
        [_values(profile, np.nan)[:4] for profile in finished], float
    ).reshape(-1, 4)

    return {"first": first, "last": last, "finished": finished, "finished_values": finished_values,
            "developing": _developing(bars, first, last, operand, va_pct)}


def _developing(bars, first: np.ndarray, last: np.ndarray, operand: dict, va_pct: float) -> np.ndarray:
    """Em cada vela de cada sessão, o perfil das velas dela já fechadas: POC,
    VAH, VAL, delta e o volume da linha do último fecho. Enquanto a máxima e a
    mínima não mudam, as linhas ficam e só se junta a vela nova (em listas: numa
    vela só, o numpy é mais lento); nos ticks por linha as linhas estão presas a
    múltiplos do passo, por isso a faixa a crescer só acrescenta linhas."""
    n = len(bars)
    result = np.full((n, 5), np.nan)
    lows, highs = bars.low.tolist(), bars.high.tolist()
    opens, closes = bars.open.tolist(), bars.close.tolist()
    volumes = bars.volume.astype(float).tolist()
    ticks = operand.get("rowsLayout") == "ticks"
    for a, b in zip(first.tolist(), last.tolist()):
        lo_seen, hi_seen = np.inf, -np.inf
        grid = None
        total: list[float] = []
        up_sum = down_sum = 0.0
        for t in range(a + 1, b + 1):
            j = t - 1
            low, high, volume = lows[j], highs[j], volumes[j]
            if closes[j] >= opens[j]:
                up_sum += volume
            else:
                down_sum += volume
            if grid is None or low < lo_seen or high > hi_seen:
                lo_seen, hi_seen = min(lo_seen, low), max(hi_seen, high)
                new = _grid(lo_seen, hi_seen, operand)
                if new is None:
                    grid = None
                    continue
                if ticks and grid is not None and new[1] == grid[1]:
                    # As mesmas linhas, mais algumas em cima ou em baixo
                    below = int(round((grid[0] - new[0]) / new[1]))
                    total = [0.0] * below + total + [0.0] * (new[2] - below - len(total))
                    grid = new
                    _add(total, grid, low, high, closes[j], volume)
                else:
                    grid = new
                    up, down = _spread(*grid, bars.low[a:t], bars.high[a:t], bars.close[a:t],
                                       bars.volume[a:t].astype(float), bars.close[a:t] >= bars.open[a:t])
                    total = (up + down).tolist()
            else:
                _add(total, grid, low, high, closes[j], volume)
            lo, step, count = grid
            poc, va_low, va_high = _value_area(total, va_pct)
            row = int((closes[j] - lo) // step)
            peak = total[poc]
            result[t] = (
                lo + (poc + 0.5) * step,
                lo + (va_high + 1) * step,
                lo + va_low * step,
                (up_sum - down_sum) / (up_sum + down_sum) * 100 if up_sum + down_sum > 0 else np.nan,
                total[row] / peak * 100 if 0 <= row < count and peak > 0 else 0.0,
            )
    return result


def _add(total: list[float], grid: tuple[float, float, int], low: float, high: float, close: float,
         volume: float) -> None:
    """Junta uma vela às linhas (`spread`, numa vela só)."""
    lo, step, count = grid
    span = high - low
    if span <= 0:
        total[max(0, min(count - 1, int((close - lo) // step)))] += volume
        return
    for r in range(max(0, int((low - lo) // step)), min(count - 1, int((high - lo) // step)) + 1):
        cover = min(high, lo + (r + 1) * step) - max(low, lo + r * step)
        if cover > 0:
            total[r] += volume * cover / span


def _naked(bars, data: dict, column: int) -> np.ndarray:
    """O nível da última sessão acabada em que ainda nenhuma vela tocou (na
    abertura de cada vela: só as fechadas contam)."""
    n = len(bars)
    result = np.full(n, np.nan)
    low, high = bars.low, bars.high
    for k, end in enumerate(data["last"].tolist()):
        level = data["finished_values"][k, column]
        if not np.isfinite(level) or end + 1 >= n:
            continue
        # A primeira vela depois da sessão que toca no nível (aos blocos, a crescer)
        touch, start, size = n, end + 1, 256
        while start < n:
            stop = min(n, start + size)
            hit = np.flatnonzero((low[start:stop] <= level) & (high[start:stop] >= level))
            if len(hit):
                touch = start + int(hit[0])
                break
            start, size = stop, size * 4
        # Da vela a seguir à sessão até à que lhe toca (na abertura dela ainda estava virgem)
        result[end + 1:min(touch, n - 1) + 1] = level
    return result


def profile_sessions(bars, tf_ms: int, operand: dict) -> dict:
    """As sessões e o perfil de cada uma (feitos uma vez, na cache): `first` e
    `last` (índices), `finished` (os perfis) e `finished_values` (POC, VAH, VAL e
    delta de cada uma)."""
    key = _key(bars, tf_ms, operand)
    data = _CACHE.get(key)
    if data is None:
        data = _compute(bars, tf_ms, operand)
        if len(_CACHE) >= _CACHE_SIZE:
            _CACHE.pop(next(iter(_CACHE)))
        # A chave usa o id das velas: guardam-se com o perfil para o id não ser reutilizado
        _CACHE[key] = data
        data["bars"] = bars
    return data


def profile_series(bars, tf_ms: int, operand: dict) -> np.ndarray:
    """O valor pedido do perfil em cada vela (NaN quando ainda não se sabe), na
    abertura dela; a vela -1 é a própria e o `offset` recua a partir dela."""
    data = profile_sessions(bars, tf_ms, operand)

    n = len(bars)
    level = operand.get("profileLevel") or "poc"
    column = PROFILE_LEVELS.index(level)
    source = operand.get("profile") or "session"
    if source == "developing":
        return data["developing"][:, column].copy()
    if source == "naked":
        cache_key = ("naked", column)
        if cache_key not in data:
            data[cache_key] = _naked(bars, data, column) if level in PRICE_LEVELS else np.full(n, np.nan)
        return data[cache_key].copy()

    # A sessão acabada N para trás: as que acabaram antes desta vela
    back = max(1, int(operand.get("sessionsBack") or 1))
    done = np.searchsorted(data["last"], np.arange(n) - 1, side="right")
    which = done - back
    result = np.full(n, np.nan)
    valid = which >= 0
    if level == "rowVolume":
        # O fecho da última vela fechada no perfil dessa sessão
        prices = np.r_[np.nan, bars.close[:-1]]
        for t in np.flatnonzero(valid).tolist():
            profile = data["finished"][which[t]]
            result[t] = profile.row_volume(float(prices[t])) if profile is not None else np.nan
        return result
    result[valid] = data["finished_values"][which[valid], column]
    return result

"""Os níveis do dia e da semana (na hora local da estratégia), como se sabem na
abertura de cada vela: a abertura do dia, a máxima e a mínima até agora (só das
velas já fechadas), as do dia e da semana anteriores e a faixa de abertura (a
máxima e a mínima dos primeiros minutos a partir de uma hora, só depois de ela
acabar)."""

import numpy as np

DAY_MS = 86_400_000
MINUTE_MS = 60_000

# Os níveis que se podem pedir (`level` no valor)
SESSION_LEVELS = (
    "day_open",
    "day_high",
    "day_low",
    "prev_day_high",
    "prev_day_low",
    "prev_day_close",
    "week_open",
    "week_high",
    "week_low",
    "prev_week_high",
    "prev_week_low",
    "range_high",
    "range_low",
)


def _groups(keys: np.ndarray) -> tuple[np.ndarray, np.ndarray]:
    """O início de cada grupo de velas seguidas com a mesma chave (dia ou semana)
    e o número do grupo de cada vela."""
    starts = np.flatnonzero(np.r_[True, keys[1:] != keys[:-1]]) if len(keys) else np.empty(0, np.int64)
    group = np.cumsum(np.r_[True, keys[1:] != keys[:-1]]) - 1 if len(keys) else np.empty(0, np.int64)
    return starts, group


def _running(values: np.ndarray, starts: np.ndarray, accumulate) -> np.ndarray:
    """O máximo (ou mínimo) acumulado dentro de cada grupo, a vela incluída."""
    result = np.empty(len(values))
    bounds = np.r_[starts, len(values)]
    for a, b in zip(bounds[:-1], bounds[1:]):
        result[a:b] = accumulate(values[a:b])
    return result


def _level(bars, keys: np.ndarray, level: str) -> np.ndarray:
    """Um nível de um período (dia ou semana) com as chaves de cada vela."""
    starts, group = _groups(keys)
    n = len(keys)
    if level == "open":
        return bars.open[starts][group].astype(float)
    if level in ("high", "low"):
        # Até agora: das velas do período já fechadas (antes desta)
        running = _running(bars.high if level == "high" else bars.low, starts,
                           np.maximum.accumulate if level == "high" else np.minimum.accumulate)
        result = np.full(n, np.nan)
        same = np.r_[False, keys[1:] == keys[:-1]]
        result[same] = running[:-1][same[1:]]
        return result
    # O período anterior inteiro: a máxima, a mínima ou o fecho
    bounds = np.r_[starts, n]
    if level == "prev_high":
        whole = np.maximum.reduceat(bars.high, starts) if n else np.empty(0)
    elif level == "prev_low":
        whole = np.minimum.reduceat(bars.low, starts) if n else np.empty(0)
    else:
        whole = bars.close[bounds[1:] - 1] if n else np.empty(0)
    previous = np.r_[np.nan, whole[:-1]]
    return previous[group].astype(float)


def session_series(chart, operand: dict) -> np.ndarray:
    """O nível pedido em cada vela da simulação (NaN quando ainda não se sabe)."""
    if chart.clock is None:
        return np.full(len(chart), np.nan)
    key = (operand["level"], operand.get("rangeStart"), operand.get("rangeMinutes"))
    if key in chart.sessions:
        return chart.sessions[key]

    bars = chart.bars
    local = chart.clock.local(bars.time)
    day = local // DAY_MS
    week = (day + 3) // 7  # 1970-01-01 foi uma quinta: as semanas começam à segunda
    level = operand["level"]
    if level.startswith("range_"):
        result = _range(chart, day, local, operand)
    else:
        period, _, what = level.partition("_")
        prev = period == "prev"
        if prev:
            period, _, what = what.partition("_")
            what = f"prev_{what}"
        result = _level(bars, day if period == "day" else week, what)
    result.setflags(write=False)
    chart.sessions[key] = result
    return result


def _range(chart, day: np.ndarray, local: np.ndarray, operand: dict) -> np.ndarray:
    """A faixa de abertura de cada dia: a máxima (ou mínima) dos minutos entre a
    hora de início e o fim dela, nos minutos de 1 minuto (não depende do tempo
    gráfico). Só conta nas velas que abrem depois de a faixa acabar, no mesmo dia.

    Uma faixa que chega à meia-noite ou a passa (20:00 durante 300 minutos) é do
    dia em que começa e conta depois de acabar, no dia seguinte, até à hora de
    início (aí começa a do dia seguinte)."""
    hours, minutes = (int(part) for part in str(operand.get("rangeStart") or "00:00").split(":")[:2])
    start = hours * 60 + minutes
    end = start + int(operand.get("rangeMinutes") or 60)
    wraps = end >= 1440
    candles = chart.minutes
    m_local = chart.clock.local(candles.time)
    m_day = m_local // DAY_MS
    m_minute = (m_local % DAY_MS) // MINUTE_MS
    # O dia da faixa de cada minuto: o próprio ou, depois da meia-noite, o anterior
    inside = (m_minute >= start) & (m_minute < end)
    if wraps:
        after_midnight = m_minute < end - 1440
        m_day = np.where(after_midnight, m_day - 1, m_day)
        inside |= after_midnight
    result = np.full(len(day), np.nan)
    if not inside.any():
        return result
    days = m_day[inside]
    values = candles.high[inside] if operand["level"] == "range_high" else candles.low[inside]
    firsts = np.flatnonzero(np.r_[True, days[1:] != days[:-1]])
    reduce = np.maximum.reduceat if operand["level"] == "range_high" else np.minimum.reduceat
    per_day = reduce(values, firsts)
    range_days = days[firsts]
    # As velas que abrem no dia de uma faixa e depois de ela acabar
    bar_minute = (local % DAY_MS) // MINUTE_MS
    if wraps:
        # Antes da hora de início, a vela ainda é do dia da faixa anterior
        day = np.where(bar_minute < start, day - 1, day)
        bar_minute = np.where(bar_minute < start, bar_minute + 1440, bar_minute)
    at = np.searchsorted(range_days, day)
    found = (at < len(range_days)) & (range_days[np.minimum(at, len(range_days) - 1)] == day)
    after = bar_minute >= end
    use = found & after
    result[use] = per_day[at[use]]
    return result

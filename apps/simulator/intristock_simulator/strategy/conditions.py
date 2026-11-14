"""Os valores, as condições e os sinais de entrada e de saída."""

import numpy as np

from .chart import Chart
from ..market.candles import TIMEFRAME_MINUTES
from .indicators import INDICATORS, WINDOWS, _shift, indicator
from .profile import profile_series
from .sessions import session_series


def operand_series(chart: Chart, operand: dict) -> np.ndarray:
    """O valor de um lado da condição em cada vela, como se sabe na abertura dela."""
    if operand["kind"] == "number":
        return np.full(len(chart), float(operand["value"]))
    if operand["kind"] == "session":
        return session_series(chart, operand)
    if operand["kind"] == "profile":
        # O perfil de volume, sempre nas velas da simulação (as que o gráfico desenha)
        size = TIMEFRAME_MINUTES.get(chart.timeframe or "", 0) * 60_000
        return _shift(profile_series(chart.bars, size, operand), -int(operand.get("offset", -1)) - 1)

    bars = chart.bars_of(operand.get("timeframe"))
    kind = operand["kind"]
    if kind in ("bullish", "bearish"):
        # Velas verdes ou vermelhas: conta-se pelo fecho − abertura de cada uma
        source = indicator(kind, bars.close - bars.open, int(operand["period"]))
    else:
        source = getattr(bars, operand["field"])
        if kind in INDICATORS or kind in WINDOWS:
            source = indicator(kind, source, int(operand["period"]), operand.get("smoothing"))

    # Vela -1 → a própria (0 para trás), -2 → a anterior, …
    back = -int(operand["offset"]) - 1
    if bars is chart.bars:
        return _shift(source, back)

    # Noutro tempo gráfico: a vela dele que contém a abertura de cada vela da
    # simulação é a -1; recua-se a partir dela
    index = np.searchsorted(bars.time, chart.bars.time, side="right") - 1 - back
    result = np.full(len(chart), np.nan)
    valid = index >= 0
    result[valid] = source[index[valid]]
    return result


def _compare(left: np.ndarray, right: np.ndarray, operator: str) -> np.ndarray:
    # Comparações com NaN (sem histórico suficiente) dão sempre falso
    with np.errstate(invalid="ignore"):
        if operator == "gt":
            return left > right
        if operator == "gte":
            return left >= right
        if operator == "lt":
            return left < right
        if operator == "lte":
            return left <= right

        before_left, before_right = _shift(left, 1), _shift(right, 1)
        if operator == "cross_above":
            return (left > right) & (before_left <= before_right)
        if operator == "cross_below":
            return (left < right) & (before_left >= before_right)

    raise ValueError(f"Operador desconhecido: {operator}")


def _condition(chart: Chart, condition: dict) -> np.ndarray:
    """Uma condição ou um grupo delas (`conditions` e `match`, como as de uma
    entrada), e depois o `within`: nalguma (any) ou em todas (all) as últimas N
    velas, a atual incluída."""
    if condition.get("conditions") is not None:
        signal = entry_signal(chart, condition["conditions"], condition.get("match"))
    else:
        signal = _comparison(chart, condition)
    within = condition.get("within")
    if within:
        signal = _within(signal, int(within["bars"]), within["mode"])
    return signal


def _within(signal: np.ndarray, bars: int, mode: str) -> np.ndarray:
    """Em cada vela, se o sinal se cumpriu nalguma ("any") ou em todas ("all")
    as últimas `bars` velas. Nas primeiras, sem `bars` velas para trás, "all" é falso."""
    total = np.cumsum(signal, dtype=np.int64)
    before = np.r_[np.zeros(bars, np.int64), total[:-bars]] if len(total) > bars else np.zeros(len(total), np.int64)
    counts = total - before
    return counts > 0 if mode == "any" else counts >= bars


def _comparison(chart: Chart, condition: dict) -> np.ndarray:
    left = operand_series(chart, condition["left"])
    right = operand_series(chart, condition["right"])
    # "acima da MME50 + 1%": o lado direito com a % somada
    factor = 1 + float(condition.get("rightPct") or 0) / 100
    right = right * factor
    if condition["operator"] == "between":
        # "o RSI entre 30 e 70": dos dois limites, inclusive; a ordem não conta
        other = operand_series(chart, condition["rightTo"]) * factor
        with np.errstate(invalid="ignore"):
            return (left >= np.minimum(right, other)) & (left <= np.maximum(right, other))
    return _compare(left, right, condition["operator"])


def entry_signal(chart: Chart, conditions: list[dict], match: str | None = None) -> np.ndarray:
    """True nas velas em que as condições se cumprem — todas, ou qualquer uma com
    `match` "any" (entra-se na abertura). Sem condições, sempre."""
    if not conditions:
        return np.ones(len(chart), dtype=bool)
    signals = [_condition(chart, condition) for condition in conditions]
    if match == "any":
        return np.logical_or.reduce(signals)
    return np.logical_and.reduce(signals)


def armed_signal(chart: Chart, signal: np.ndarray, setup: dict | None, events: dict | None = None) -> np.ndarray:
    """O sinal de uma entrada com preparação: primeiro as condições da preparação
    (ficam armadas `bars` velas, a contar da seguinte), depois as da entrada. Um
    sinal desarma (é preciso preparar outra vez); as de cancelar desarmam antes, e
    a preparação a cumprir-se outra vez recomeça a contagem. Na vela em que se
    arma ainda não entra: é primeiro uma e depois a outra.

    `events` (se vier) fica com as velas de cada acontecimento, para o funil: `arm`
    (armou, estando desarmada), `rearm` (cumpriu-se outra vez armada), `expire` (a
    janela acabou sem sinal; a vela em que acabou), `cancel` e `fire` (o sinal:
    (vela, velas desde que armou))."""
    if events is not None:
        events.update(arm=[], rearm=[], expire=[], cancel=[], fire=[])
    if not setup:
        return signal
    arm = entry_signal(chart, setup["conditions"], setup.get("match"))
    cancel = (
        entry_signal(chart, setup["cancel"], setup.get("cancelMatch"))
        if setup.get("cancel")
        else np.zeros(len(chart), bool)
    )
    bars = max(1, int(setup.get("bars") or 1))
    result = np.zeros(len(chart), bool)
    # Só as velas em que alguma coisa acontece (são poucas comparadas com todas)
    armed_at = -1
    for t in np.flatnonzero(arm | signal | cancel).tolist():
        if armed_at >= 0 and t - armed_at > bars:
            if events is not None:
                events["expire"].append(armed_at + bars + 1)
            armed_at = -1
        elif armed_at >= 0 and cancel[t]:
            if events is not None:
                events["cancel"].append(t)
            armed_at = -1
        if armed_at >= 0 and signal[t]:
            result[t] = True
            if events is not None:
                events["fire"].append((t, t - armed_at))
            armed_at = -1
        if arm[t]:
            if events is not None:
                events["rearm" if armed_at >= 0 else "arm"].append(t)
            armed_at = t
    # Armada no fim: acaba sem sinal se a janela coube nas velas
    if events is not None and armed_at >= 0 and armed_at + bars + 1 < len(chart):
        events["expire"].append(armed_at + bars + 1)
    return result


def exit_level(chart: Chart, price: dict) -> np.ndarray:
    """O preço de uma entrada ou saída em cada vela: a abertura (ao mercado) ou
    um nível — o preço de uma vela, uma média ou um número — como se sabe na
    abertura."""
    if price["kind"] == "market":
        return chart.bars.open
    return operand_series(chart, price)

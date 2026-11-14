"""Preços de execução, níveis tocados, slippage e a procura do stop e do take profit
minuto a minuto."""

import numpy as np

from ..market.candles import Bars, Candles
from .models import Order
from .stop_rules import RULE_KIND


# Minutos analisados de cada vez à procura do stop; cresce se não encontrar
SEARCH_WINDOW = 4096


def _market_prices(bars: Bars, minutes: Candles, mode: str | None) -> np.ndarray:
    """O preço de uma ordem ao mercado em cada vela: a abertura, o fecho da vela
    anterior (a do sinal) ou o preço médio do primeiro minuto."""
    if mode == "signal_close" and len(bars):
        return np.r_[bars.open[:1], bars.close[:-1]].astype(np.float64)
    if mode == "first_minute_avg":
        first = bars.first_minute
        return (minutes.open[first] + minutes.high[first] + minutes.low[first] + minutes.close[first]) / 4
    return bars.open


def _touch(bars: Bars, minutes: Candles, bar: int, level: float, rising: bool, start: int | None = None,
           allowed=None):
    """Primeiro minuto da vela `bar` (a partir de `start`) em que o preço chega
    ao nível, a subir ou a descer: (minuto, preço, rising) ou None. `allowed(a, b)`
    diz em que minutos de a a b (exclusivo) a ordem pode entrar (None: todos)."""
    first = int(bars.first_minute[bar])
    begin = first if start is None else max(first, start)
    last = int(bars.first_minute[bar + 1]) if bar + 1 < len(bars) else len(minutes)
    opens = minutes.open[begin:last]
    mask = allowed(begin, last) if allowed is not None and last > begin else None
    if rising:
        reached = minutes.high[begin:last] >= level
        hits = np.flatnonzero(reached if mask is None else reached & mask)
        if not len(hits):
            return None
        return begin + int(hits[0]), max(level, float(opens[hits[0]])), True
    reached = minutes.low[begin:last] <= level
    hits = np.flatnonzero(reached if mask is None else reached & mask)
    if not len(hits):
        return None
    return begin + int(hits[0]), min(level, float(opens[hits[0]])), False


def _fill(order: Order, bars: Bars, minutes: Candles, bar: int, market, start: int | None = None, reference=None):
    """Minuto, preço e sentido da ordem na vela `bar`, a partir do minuto
    `start` (por omissão o início da vela). None se o preço não chegar ao nível
    nesse tempo.

    O nível apanha-se a subir se estiver acima de `reference` (o preço quando a
    ordem se põe: a abertura da vela ou, na vela da entrada, o preço de entrada)
    e a descer se estiver abaixo. O sentido é True a subir, False a descer e
    None ao mercado."""
    if order.market:
        return int(bars.first_minute[bar]), float(market[bar]), None
    level = float(order.level[bar])
    rising = level >= (bars.open[bar] if reference is None else reference)
    return _touch(bars, minutes, bar, level, rising, start)


def _reach(minutes: Candles, start: int, last: int, level: float, direction: int):
    """Primeiro minuto de `start` a `last` (inclusive) em que o preço chega a um
    nível a favor (acima numa compra, abaixo numa venda): (minuto, preço) — o
    nível, ou a abertura se já abriu para lá dele — ou None."""
    if last < start:
        return None
    if direction == 1:
        hits = np.flatnonzero(minutes.high[start:last + 1] >= level)
    else:
        hits = np.flatnonzero(minutes.low[start:last + 1] <= level)
    if not len(hits):
        return None
    minute = start + int(hits[0])
    opened = float(minutes.open[minute])
    return minute, opened if direction * (opened - level) > 0 else level


def _slipped(rising: bool | None, buying: bool) -> bool:
    """Se a ordem leva slippage: ao mercado sempre; num nível, só quando é uma
    ordem stop (comprar a subir, vender a descer)."""
    return rising is None or rising == buying


def _find_stop(
    minutes: Candles,
    start: int,
    total: int,
    direction: int,
    stop,
    target,
    liquidation=None,
    entry=None,
    trail=None,
    break_even=None,
    stop_mask=None,
    target_mask=None,
    best=None,
    stop_reason="stop_loss",
    path=None,
):
    """Primeiro minuto, de `start` até antes de `total`, em que o stop (fixo,
    trailing ou break-even), o take profit ou a liquidação batem. Devolve
    (índice, motivo, preço, ajuste) ou None.

    O trailing e o break-even medem-se do melhor preço até ao minuto anterior
    (dentro de um minuto não se sabe o que veio primeiro). `stop_mask` e
    `target_mask` dizem em que minutos o stop e o take profit valem. Depois de
    uma saída parcial procura-se outra vez a partir dela: `best` é o melhor preço
    até lá e `stop_reason` o motivo do stop fixo (break_even, se passou à entrada).
    `path(início, fim)` dá o stop movido pelos ajustes em cada minuto e o código do
    ajuste que o pôs lá (`stop_rules.RULE_KIND` + o índice; o motivo vem de
    `path.reasons`); conta quando é melhor do que o fixo. Num stop, o 4.º valor é
    o ajuste (1, 2…) que o pôs lá, ou None (o da entrada)."""
    dynamic = trail is not None or break_even is not None
    if stop is None and target is None and liquidation is None and not dynamic and path is None:
        return None
    window = SEARCH_WINDOW
    position = start
    long = direction == 1
    has_stop = stop is not None or dynamic or path is not None
    # Sem stop, um nível que nunca bate
    nothing = -np.inf if long else np.inf
    best = entry if best is None else best  # o melhor preço desde a entrada (o máximo numa compra)

    while position < total:
        end = min(position + window, total)
        high, low = minutes.high[position:end], minutes.low[position:end]
        size = end - position
        none = np.zeros(size, bool)

        levels = np.full(size, stop if stop is not None else nothing, dtype=np.float64)
        kind = np.zeros(size, np.int8)  # 0 o stop fixo, 1 trailing, 2 break-even, 3 movido (stop_loss)
        if path is not None:
            moved, moved_kind = path(position, end)
            with np.errstate(invalid="ignore"):
                better = moved > levels if long else moved < levels
            levels, kind = np.where(better, moved, levels), np.where(better, moved_kind, kind)
        if dynamic:
            if long:
                prior = np.maximum.accumulate(np.r_[best, high[:-1]])
                best = max(best, float(high.max()))
            else:
                prior = np.minimum.accumulate(np.r_[best, low[:-1]])
                best = min(best, float(low.min()))
            if break_even is not None:
                reached = prior >= entry * (1 + break_even) if long else prior <= entry * (1 - break_even)
                level = np.where(reached, entry, nothing)
                better = level > levels if long else level < levels
                levels, kind = np.where(better, level, levels), np.where(better, 2, kind)
            if trail is not None:
                level = prior * (1 - trail) if long else prior * (1 + trail)
                better = level > levels if long else level < levels
                levels, kind = np.where(better, level, levels), np.where(better, 1, kind)

        if long:
            stop_hit = low <= levels if has_stop else none
            target_hit = high >= target if target is not None else none
            liquidation_hit = low <= liquidation if liquidation is not None else none
        else:
            stop_hit = high >= levels if has_stop else none
            target_hit = low <= target if target is not None else none
            liquidation_hit = high >= liquidation if liquidation is not None else none
        if stop_mask is not None:
            stop_hit = stop_hit & stop_mask[position:end]
        if target_mask is not None:
            target_hit = target_hit & target_mask[position:end]

        hits = np.flatnonzero(stop_hit | target_hit | liquidation_hit)
        if len(hits):
            offset = hits[0]
            index = position + offset
            opened = minutes.open[index]
            level = float(levels[offset])
            if liquidation_hit[offset]:
                # Antes do stop se o preço já abriu para lá dela ou se está mais perto
                gapped = opened <= liquidation if long else opened >= liquidation
                nearer = not stop_hit[offset] or (liquidation >= level if long else liquidation <= level)
                if gapped or nearer:
                    return index, "liquidation", liquidation, None
            if stop_hit[offset]:
                gapped = opened < level if long else opened > level
                code = int(kind[offset])
                if code >= RULE_KIND:
                    reason, rule = path.reasons[code - RULE_KIND], code - RULE_KIND + 1
                else:
                    reason, rule = (stop_reason, "trailing_stop", "break_even", "stop_loss")[code], None
                return index, reason, opened if gapped else level, rule
            gapped = opened > target if long else opened < target
            return index, "take_profit", opened if gapped else target, None

        position = end
        window *= 2

    return None

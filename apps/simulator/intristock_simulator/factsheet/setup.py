"""2.1 a 2.3 — A qualidade das velas, o funil de sinais e as ordens."""

from __future__ import annotations

import math

import numpy as np

from ..market.candles import Bars, Candles, MINUTE_MS, TIMEFRAME_MINUTES, empty_bars
from .columns import VERSION
from .common import DAY_MS, SHARPE_YEAR_DAYS, _round


# 2.2 — os contadores do funil, que o motor enche: cada sinal (uma vela em que as
# condições de uma entrada se cumpriram) conta uma vez, no primeiro motivo que o
# parou; os que passam entram ao mercado ou põem uma ordem num nível
FUNNEL_KEYS = (
    "signals",
    "blockedSchedule",  # horários bloqueados, períodos excluídos e o horário da entrada
    "blockedCooldown",  # a pausa depois de uma saída
    "blockedPyramid",  # a entrada já tem as posições (ou a ordem) que pode ter
    "blockedMaxPositions",  # o máximo de posições ao mesmo tempo
    "blockedOpposite",  # uma posição da outra direção (ou o sinal que a fechou)
    "blockedDaily",  # os limites do dia
    "blockedGuards",  # «não operar se»
    "blockedContext",  # as condições da conta da entrada («só entra se»)
    "noCapital",  # sem capital livre
    "ordersPlaced",  # ordens num nível
    "ordersExpired",  # ordens que caíram sem entrar
    "rejectedMinimum",  # abaixo da quantidade ou do valor mínimo
    "invalidStop",  # o stop (na mínima/máxima ou num nível) ficava do lado errado do preço
)


def signal_funnel(counts: dict, simulated_bars: int, trades: list) -> dict:
    """2.2 — Funil de sinais: as velas simuladas, os sinais, cada motivo por que
    não entraram, as ordens num nível (postas e caídas), as rejeitadas pelo mínimo
    e os trades (todos e com lucro, o pnl líquido acima de 0)."""
    return {
        "version": VERSION,
        "simulatedBars": int(simulated_bars),
        **{key: int(counts.get(key, 0)) for key in FUNNEL_KEYS},
        "trades": len(trades),
        "winningTrades": sum(1 for trade in trades if trade.pnl > 0),
    }


def entry_breakdown(entries: list[dict], signals_by_rule: list[int], trades: list) -> dict:
    """2.2 — Por entrada: os sinais (como no funil), os trades fechados, a % de
    sinais que deram trade, o win rate, o P&L líquido e a expectancy em R — a
    média do P&L de cada trade sobre o que perderia no stop (quantidade × preço
    de entrada × a distância ao stop desse trade); sem stop, não há R."""
    rows = []
    for index, entry in enumerate(entries):
        own = [trade for trade in trades if trade.entry_rule == index + 1]
        signals = int(signals_by_rule[index]) if index < len(signals_by_rule) else 0
        multiples = [
            trade.pnl / (trade.quantity * trade.entry_price * trade.stop_pct / 100)
            for trade in own
            if trade.stop_pct and trade.quantity * trade.entry_price > 0
        ]
        rows.append({
            "rule": index + 1,
            "signals": signals,
            "trades": len(own),
            "executedPct": _round(len(own) / signals * 100 if signals else None, 2),
            "winRatePct": _round(sum(1 for trade in own if trade.pnl > 0) / len(own) * 100 if own else None, 2),
            "pnl": _round(float(sum(trade.pnl for trade in own)), 2),
            "expectancyR": _round(float(np.mean(multiples)) if multiples else None, 3),
        })
    return {"version": VERSION, "entries": rows}


def order_execution(entries: list[dict], stats: dict, trades: list) -> dict:
    """2.3 — As ordens num nível, somadas: as entradas que as usam, as postas, as
    executadas (deram trade), as que caíram (o preço não chegou na validade, ou
    chegou e a posição já não podia abrir), as canceladas (a condição deixou de
    valer), a espera média em velas até executar e o slippage que as limite não
    pagaram (estimativa: o slippage da simulação sobre o valor de entrada)."""
    rules = [
        index + 1 for index, entry in enumerate(entries)
        if (entry.get("price") or {"kind": "market"})["kind"] != "market"
    ]
    level = [trade for trade in trades if trade.order_kind != "market"]
    placed = sum(stats["placed"])
    filled = sum(stats["filled"])
    return {
        "version": VERSION,
        "rules": rules,
        "orderBars": sorted({max(1, int(entries[rule - 1].get("orderBars") or 1)) for rule in rules}),
        "placed": placed,
        "filled": filled,
        "executedPct": _round(filled / placed * 100 if placed else None, 2),
        "expired": sum(stats["expired"]),
        "cancelled": sum(stats["cancelled"]),
        "avgWaitBars": _round(float(np.mean([trade.wait_bars for trade in level])) if level else None, 2),
        "slippageSaved": _round(float(sum(trade.slippage_saved for trade in level)), 2),
    }


ORDER_KINDS = ("market", "limit", "stop")


def order_types(trades: list) -> dict:
    """2.3 — Resultado por tipo de ordem (a mercado, limite, stop): trades,
    espera média em velas, win rate, profit factor, expectancy (P&L médio) e o
    slippage pago (entrada e saída)."""
    rows = []
    for kind in ORDER_KINDS:
        own = [trade for trade in trades if trade.order_kind == kind]
        if not own:
            continue
        gains = sum(trade.pnl for trade in own if trade.pnl > 0)
        losses = -sum(trade.pnl for trade in own if trade.pnl < 0)
        rows.append({
            "kind": kind,
            "trades": len(own),
            "avgWaitBars": _round(float(np.mean([trade.wait_bars for trade in own])), 2),
            "winRatePct": _round(sum(1 for trade in own if trade.pnl > 0) / len(own) * 100, 2),
            "profitFactor": _round(gains / losses if losses > 0 else None, 2),
            "expectancy": _round(float(np.mean([trade.pnl for trade in own])), 2),
            "slippage": _round(float(sum(trade.slippage for trade in own)), 2),
        })
    return {"version": VERSION, "rows": rows}


# Um gap de abertura conta a partir desta distância ao fecho da vela anterior
GAP_THRESHOLD_PCT = 0.2


def data_quality(bars: Bars, minutes: Candles, first_bar: int, start_ms: int, end_ms: int,
                 timeframe: str | None) -> dict:
    """2.1 — Qualidade dos dados: as velas que a corrida usou. As simuladas (do
    início ao fim) e as de aquecimento (antes do início, para as médias); as que
    faltam no tempo gráfico e os minutos que faltam no período; os gaps de
    abertura (abertura a mais de 0,2% do fecho anterior); a amplitude média e a
    maior vela ((máxima − mínima) / abertura); o preço inicial (abertura da
    primeira vela) e o final (o último fecho); e a volatilidade anualizada do
    ativo nos fechos diários UTC (√365)."""
    size = TIMEFRAME_MINUTES.get(timeframe or "", 0) * MINUTE_MS
    simulated = slice(first_bar, len(bars))
    opens, highs, lows, closes = (bars.open[simulated].astype(float), bars.high[simulated].astype(float),
                                  bars.low[simulated].astype(float), bars.close[simulated].astype(float))
    count = len(opens)
    # As velas paradas (os buracos que o `to_bars` enche) contam como em falta
    real = ~empty_bars(bars, len(minutes))[simulated]

    expected_bars = (end_ms // size - start_ms // size + 1) if size else count
    in_period = int(np.count_nonzero(minutes.time >= start_ms))
    expected_minutes = (end_ms - start_ms) // MINUTE_MS + 1

    previous = bars.close[max(first_bar - 1, 0):len(bars) - 1].astype(float)
    if first_bar == 0:
        previous = np.r_[np.nan, previous]
    with np.errstate(divide="ignore", invalid="ignore"):
        gaps = np.abs(opens / previous - 1) * 100
        ranges = np.where(opens > 0, (highs - lows) / opens * 100, 0.0)
    ranges = np.where(real, ranges, np.nan)
    biggest = int(np.nanargmax(ranges)) if real.any() else None

    # Os fechos diários (UTC) do período, com o preço de abertura como ponto de partida
    days = np.arange(start_ms // DAY_MS * DAY_MS + DAY_MS, end_ms + 1, DAY_MS)
    period = minutes.time >= start_ms
    times, prices = minutes.time[period], minutes.close[period].astype(float)
    daily = np.array([])
    if len(times) and len(days):
        positions = np.searchsorted(times, days, side="left") - 1
        marks = np.r_[float(minutes.open[period][0]), prices[np.clip(positions, 0, None)], prices[-1]]
        daily = marks[1:] / marks[:-1] - 1
    volatility = float(np.std(daily, ddof=1)) * math.sqrt(SHARPE_YEAR_DAYS) * 100 if len(daily) > 1 else None

    return {
        "version": VERSION,
        "simulatedBars": int(count),
        "warmupBars": int(first_bar),
        "warmupFromTime": int(bars.time[0]) if len(bars) else None,
        "missingBars": int(max(expected_bars - int(real.sum()), 0)),
        "missingMinutes": int(max(expected_minutes - in_period, 0)),
        "gapThresholdPct": GAP_THRESHOLD_PCT,
        "openingGaps": int(np.count_nonzero(gaps[np.isfinite(gaps)] > GAP_THRESHOLD_PCT)),
        "averageRangePct": _round(float(np.nanmean(ranges)) if real.any() else None, 3),
        "maxRangePct": _round(float(ranges[biggest]) if biggest is not None else None, 3),
        "maxRangeTime": int(bars.time[first_bar + biggest]) if biggest is not None else None,
        "startPrice": _round(float(opens[0]) if count else None, 8),
        "endPrice": _round(float(minutes.close[-1]) if len(minutes) else None, 8),
        "volatilityPct": _round(volatility, 2),
    }

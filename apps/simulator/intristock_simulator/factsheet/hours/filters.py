"""5.8 — Os filtros de horário sugeridos pelos dados."""

from __future__ import annotations

import numpy as np

from ...market.candles import Candles
from ..common import STOP_EXIT, _round
from ..equity import _daily_equity, _max_drawdown, _performance_index
from .day_hour_grid import GRID_MIN_TRADES
from .weekdays import _weekday


# 5.8: as horas das tabelas dentro vs fora, as piores horas que se bloqueiam,
# as melhores com que se fica, a % de stops de uma hora a bloquear e a madrugada
FILTER_TABLE_HOURS = 6
FILTER_WORST_HOURS = 3
FILTER_BEST_HOURS = 8
FILTER_STOPS_PCT = 50
FILTER_NIGHT_HOURS = list(range(0, 6))


def _group_stats(group) -> dict:
    n = len(group)
    return {
        "trades": n,
        "expectancy": _round(sum(t.pnl for t in group) / n, 2) if n else None,
        "stopsPct": _round(sum(1 for t in group if t.exit_reason == STOP_EXIT) / n * 100, 2) if n else None,
        "winRatePct": _round(sum(1 for t in group if t.pnl > 0) / n * 100, 2) if n else None,
    }


def filter_candidates(trades, local, split_ms: int) -> dict:
    """5.8 — O que os filtros usam, só da parte dentro da amostra (pela entrada,
    antes de `split_ms`): as horas locais de entrada com pelo menos
    `GRID_MIN_TRADES` trades por expectancy, as que têm ≥ `FILTER_STOPS_PCT` %
    de stops, o pior dia (P&L) e a hora local de saída com mais stops; e as 6
    piores e melhores horas, com o que fizeram dentro e fora."""
    hour_ms = 3_600_000
    entry_local = np.asarray(local([t.entry_time for t in trades]), np.int64) if trades else np.empty(0, np.int64)
    exit_local = np.asarray(local([t.exit_time for t in trades]), np.int64) if trades else np.empty(0, np.int64)
    inside = [[] for _ in range(24)]
    outside = [[] for _ in range(24)]
    days = [0.0] * 7
    day_trades = [0] * 7
    exit_stops = [0] * 24
    for trade, entry_ms, exit_ms in zip(trades, entry_local, exit_local):
        hour = int(entry_ms // hour_ms) % 24
        if trade.entry_time < split_ms:
            inside[hour].append(trade)
            days[_weekday(int(entry_ms))] += trade.pnl
            day_trades[_weekday(int(entry_ms))] += 1
            exit_stops[int(exit_ms // hour_ms) % 24] += trade.exit_reason == STOP_EXIT
        else:
            outside[hour].append(trade)

    stats_in = [_group_stats(g) for g in inside]
    eligible = [h for h in range(24) if stats_in[h]["trades"] >= GRID_MIN_TRADES]
    ranked = sorted(eligible, key=lambda h: (stats_in[h]["expectancy"], h))

    def row(hour: int) -> dict:
        own_in, own_out = stats_in[hour], _group_stats(outside[hour])
        holds = None
        if own_out["trades"]:
            holds = (own_in["expectancy"] < 0) == (own_out["expectancy"] < 0)
        return {"hour": hour, "inside": own_in, "outside": own_out, "holds": holds}

    traded_days = [d for d in range(7) if day_trades[d]]
    worst_day = min(traded_days, key=lambda d: (days[d], d), default=None)
    most_stops = max(range(24), key=lambda h: (exit_stops[h], -h)) if any(exit_stops) else None
    return {
        "worstHours": [h for h in ranked if stats_in[h]["expectancy"] < 0][:FILTER_WORST_HOURS],
        "bestHours": sorted(ranked[::-1][:FILTER_BEST_HOURS]) if len(ranked) >= FILTER_BEST_HOURS else [],
        "stopHours": sorted(h for h in eligible if stats_in[h]["stopsPct"] >= FILTER_STOPS_PCT),
        "worstDay": worst_day,
        "exitStopHour": most_stops,
        "worstTable": [row(h) for h in ranked[:FILTER_TABLE_HOURS]],
        "bestTable": [row(h) for h in ranked[::-1][:FILTER_TABLE_HOURS]],
    }


def variant_stats(trades, initial, deposits, deposit_amounts, minutes: Candles, start_ms: int, end_ms: int,
                  split_ms: int) -> dict:
    """5.8 e 5.9 — Uma corrida de uma variante: a maior queda (no índice) e o
    retorno dentro e fora da amostra (o índice até e desde o dia da divisão)."""
    marks, _, values, invested_at = _daily_equity(trades, initial, deposits, deposit_amounts, minutes, start_ms, end_ms)
    index = _performance_index(values, invested_at)
    cut = max(int(np.searchsorted(marks, split_ms, side="right")) - 1, 0)

    def growth(part):
        return (float(part[-1] / part[0]) - 1) * 100 if len(part) > 1 and part[0] > 0 else None

    # A queda negativa, como na 3.1
    return {"maxDrawdownPct": -_max_drawdown(index), "inReturnPct": growth(index[:cut + 1]), "outReturnPct": growth(index[cut:])}

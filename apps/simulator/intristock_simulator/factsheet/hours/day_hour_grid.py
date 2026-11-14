"""5.4 — Dia da semana × hora."""

from __future__ import annotations

import numpy as np

from ..columns import VERSION
from ..common import SAMPLE_MIN_TRADES, STOP_EXIT, _round
from .weekdays import _weekday


# 5.4: o win rate de uma célula só conta a partir deste número de trades, e a
# escala do P&L médio vai até este percentil (em módulo; as células acima ficam
# na cor mais forte, para uma só não apagar as outras)
GRID_MIN_TRADES = 3
GRID_PNL_PERCENTILE = 90


def weekday_hours_report(trades, local, zone: str) -> dict:
    """5.4 — Dia da semana × hora, pelo dia e pela hora locais em que o trade
    abriu: quatro mapas com o mesmo quadriculado (7 linhas, 0 = segunda, × 24
    horas). Cada um traz os trades de cada célula, para o tooltip; nulo = sem
    trades (no win rate também com menos de `GRID_MIN_TRADES`); o P&L traz o
    limite da escala (`scale`, o percentil `GRID_PNL_PERCENTILE` em módulo)."""
    hour_ms = 3_600_000
    count = [[0] * 24 for _ in range(7)]
    stops = [[0] * 24 for _ in range(7)]
    wins = [[0] * 24 for _ in range(7)]
    pnl = [[0.0] * 24 for _ in range(7)]
    entry_local = np.asarray(local([t.entry_time for t in trades]), np.int64) if trades else []
    for trade, ms in zip(trades, entry_local):
        day, hour = _weekday(int(ms)), int(ms // hour_ms) % 24
        count[day][hour] += 1
        stops[day][hour] += trade.exit_reason == STOP_EXIT
        wins[day][hour] += trade.pnl > 0
        pnl[day][hour] += trade.pnl

    def grid(value):
        return [[value(day, hour) for hour in range(24)] for day in range(7)]

    head = {"version": VERSION, "timezone": zone, "minTrades": SAMPLE_MIN_TRADES}
    sizes = [abs(pnl[d][h] / count[d][h]) for d in range(7) for h in range(24) if count[d][h]]
    scale = _round(float(np.percentile(sizes, GRID_PNL_PERCENTILE)), 2) if sizes else None
    return {
        "weekdayHourTrades": {**head, "trades": count, "max": max(max(row) for row in count)},
        "weekdayHourStops": {**head, "stops": grid(lambda d, h: stops[d][h] if count[d][h] else None),
                             "trades": count, "max": max(max(row) for row in stops)},
        "weekdayHourWinRate": {**head, "minTrades": GRID_MIN_TRADES,
                               "winRatePct": grid(lambda d, h: _round(wins[d][h] / count[d][h] * 100, 2)
                                                  if count[d][h] >= GRID_MIN_TRADES else None),
                               "wins": wins, "trades": count},
        "weekdayHourPnl": {**head, "avgPnl": grid(lambda d, h: _round(pnl[d][h] / count[d][h], 2) if count[d][h] else None),
                           "pnl": grid(lambda d, h: _round(pnl[d][h], 2) if count[d][h] else None), "trades": count, "scale": scale},
    }

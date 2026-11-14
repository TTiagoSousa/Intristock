"""5.6 — Cada entrada por hora."""

from __future__ import annotations

import numpy as np

from ..columns import VERSION
from ..common import SAMPLE_MIN_TRADES, STOP_EXIT, _round


# 5.6: os blocos de horas do quadro entrada × bloco
HOUR_BLOCK = 4


def entry_hours_report(trades, entries: list[dict], local, zone: str, bands: list) -> dict:
    """5.6 — Cada entrada por hora, pela hora local de entrada: para cada uma,
    os trades de cada hora que fecharam a ganhar, em stop e noutra saída, o P&L,
    os 3 cartões e as horas em que o horário dela deixa entrar (`bands`, nulo =
    sem horário); e o quadro entrada × bloco de 4 horas."""
    hour_ms = 3_600_000
    hours = [int(v // hour_ms) % 24 for v in np.asarray(local([t.entry_time for t in trades]), np.int64)] if trades else []
    rules = sorted(set(range(1, len(entries) + 1)) | {t.entry_rule for t in trades})
    own = {rule: [[] for _ in range(24)] for rule in rules}
    for trade, hour in zip(trades, hours):
        own[trade.entry_rule][hour].append(trade)

    profiles = []
    blocks = []
    for rule in rules:
        groups = own[rule]
        stops = [sum(1 for t in g if t.exit_reason == STOP_EXIT) for g in groups]
        wins = [sum(1 for t in g if t.exit_reason != STOP_EXIT and t.pnl > 0) for g in groups]
        counts = [len(g) for g in groups]
        pnl = [sum(t.pnl for t in g) for g in groups]
        used = [h for h in range(24) if counts[h]]
        busiest = max(used, key=lambda h: (counts[h], -h), default=None)
        best = max(used, key=lambda h: (pnl[h], -h), default=None)
        stopped = [h for h in used if stops[h]]
        most = max(stopped, key=lambda h: (stops[h], stops[h] / counts[h], -h), default=None)
        profiles.append({
            "rule": rule,
            "trades": sum(counts),
            "stops": sum(stops),
            "wins": wins,
            "stopHours": stops,
            "others": [counts[h] - wins[h] - stops[h] for h in range(24)],
            "pnl": [_round(v, 2) for v in pnl],
            "band": bands[rule - 1] if rule - 1 < len(bands) else None,
            "busiest": {"hour": busiest, "trades": counts[busiest]} if busiest is not None else None,
            "best": {"hour": best, "pnl": _round(pnl[best], 2),
                     "winRatePct": _round(sum(1 for t in groups[best] if t.pnl > 0) / counts[best] * 100, 2)}
            if best is not None else None,
            "mostStops": {"hour": most, "stops": stops[most], "trades": counts[most]} if most is not None else None,
        })

        cells = []
        for block in range(24 // HOUR_BLOCK):
            group = [t for h in range(block * HOUR_BLOCK, (block + 1) * HOUR_BLOCK) for t in groups[h]]
            if not group:
                cells.append(None)
                continue
            total = sum(t.pnl for t in group)
            cells.append({"trades": len(group), "winRatePct": _round(sum(1 for t in group if t.pnl > 0) / len(group) * 100, 2),
                          "pnl": _round(total, 2), "expectancy": _round(total / len(group), 2)})
        traded = [b for b, cell in enumerate(cells) if cell]
        top = max(traded, key=lambda b: (cells[b]["pnl"], -b), default=None)
        low = min(traded, key=lambda b: (cells[b]["pnl"], b), default=None)
        blocks.append({"rule": rule, "cells": cells, "best": top, "worst": low if len(traded) > 1 else None})

    sizes = [abs(cell["expectancy"]) for row in blocks for cell in row["cells"] if cell]
    head = {"version": VERSION, "timezone": zone}
    return {
        "entryHourProfiles": {**head, "entries": profiles},
        "entryHourBlocks": {**head, "minTrades": SAMPLE_MIN_TRADES, "blockHours": HOUR_BLOCK, "rows": blocks,
                            "scale": _round(max(sizes), 2) if sizes else None},
    }

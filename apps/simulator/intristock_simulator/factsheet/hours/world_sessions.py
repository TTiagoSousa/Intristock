"""5.10 — Sessões mundiais e horário de trabalho."""

from __future__ import annotations

import numpy as np

from ...market.candles import Candles
from ..columns import VERSION
from ..common import DAY_MS, STOP_EXIT, _mean, _round


# 5.10: as quatro bolsas em horas UTC (fixas, como no estudo) e as sobreposições
WORLD_SESSIONS = [
    ("sydney", [22, 23, 0, 1, 2, 3, 4, 5, 6]),
    ("tokyo", list(range(0, 9))),
    ("london", list(range(8, 17))),
    ("newYork", list(range(13, 22))),
    ("londonNewYork", list(range(13, 17))),
    ("sydneyTokyo", list(range(0, 7))),
    ("sydneyOnly", [22, 23]),
]
# A primeira e a última hora (UTC) de cada bolsa
SESSION_EDGES = [("sydney", 22, 6), ("tokyo", 0, 8), ("london", 8, 16), ("newYork", 13, 21)]
# O horário de trabalho (na hora local): de segunda a sexta, das 9 às 18 h
WORK_HOURS = range(9, 18)


def world_sessions_report(trades, local, zone: str, minutes: Candles, start_ms: int, end_ms: int) -> dict:
    """5.10 — Sessões mundiais e horário de trabalho. Por sessão (pela hora UTC
    de entrada; uma hora com duas sessões conta nas duas): trades, win rate,
    stops, P&L, expectancy e a volatilidade (a amplitude média das velas de
    1 hora nessas horas, em %). O horário de trabalho na hora local (segunda a
    sexta 9h–18h), o fim de tarde e a noite, a madrugada, o fim de semana e
    cada diferença para UTC (inverno e verão): as horas do período, os trades
    e os trades por 100 horas. E a primeira e a última hora de cada bolsa
    contra o resto da sessão."""
    hour_ms = 3_600_000
    head = {"version": VERSION, "timezone": zone}
    utc_hours = [int(t.entry_time // hour_ms) % 24 for t in trades]

    # As velas de 1 hora: a amplitude de cada uma, pela hora UTC
    inside = (minutes.time >= start_ms) & (minutes.time < end_ms)
    times = np.asarray(minutes.time[inside], np.int64)
    ranges = [[] for _ in range(24)]
    if len(times):
        bucket = times // hour_ms
        cuts = np.flatnonzero(np.diff(bucket)) + 1
        starts = np.concatenate(([0], cuts))
        high = np.maximum.reduceat(np.asarray(minutes.high[inside], float), starts)
        low = np.minimum.reduceat(np.asarray(minutes.low[inside], float), starts)
        opened = np.asarray(minutes.open[inside], float)[starts]
        pct = np.where(opened > 0, (high - low) / np.where(opened > 0, opened, 1) * 100, np.nan)
        for hour, value in zip(bucket[starts] % 24, pct):
            if not np.isnan(value):
                ranges[int(hour)].append(float(value))

    def summary(group) -> dict:
        n = len(group)
        stops = sum(1 for t in group if t.exit_reason == STOP_EXIT)
        pnl = sum(t.pnl for t in group)
        return {"trades": n, "winRatePct": _round(sum(1 for t in group if t.pnl > 0) / n * 100, 2) if n else None,
                "stops": stops, "stopsPct": _round(stops / n * 100, 2) if n else None, "pnl": _round(pnl, 2),
                "expectancy": _round(pnl / n, 2) if n else None}

    sessions = []
    for key, hours in WORLD_SESSIONS:
        group = [t for t, h in zip(trades, utc_hours) if h in hours]
        values = [v for h in hours for v in ranges[h]]
        sessions.append({"session": key, "from": hours[0], "to": (hours[-1] + 1) % 24, **summary(group),
                         "volatilityPct": _round(_mean(values), 4)})

    edges = []
    for key, first, last in SESSION_EDGES:
        hours = dict(WORLD_SESSIONS)[key]
        rest = [h for h in hours if h not in (first, last)]
        edges.append({
            "session": key, "first": first, "last": last,
            "firstHour": summary([t for t, h in zip(trades, utc_hours) if h == first]),
            "lastHour": summary([t for t, h in zip(trades, utc_hours) if h == last]),
            "rest": summary([t for t, h in zip(trades, utc_hours) if h in rest]),
        })

    # O horário de trabalho: cada hora UTC do período na hora local, e cada trade pela entrada
    slots = np.arange(start_ms // hour_ms, (end_ms - 1) // hour_ms + 1, dtype=np.int64) * hour_ms
    slot_local = np.asarray(local(slots), np.int64)
    entry_local = np.asarray(local([t.entry_time for t in trades]), np.int64) if trades else np.empty(0, np.int64)

    def masks(local_ms: np.ndarray) -> dict:
        hour = (local_ms // hour_ms) % 24
        weekday = (local_ms // DAY_MS + 3) % 7
        weekdays = weekday < 5
        return {"work": weekdays & (hour >= WORK_HOURS.start) & (hour < WORK_HOURS.stop),
                "evening": weekdays & (hour >= WORK_HOURS.stop), "night": hour < 7, "weekend": ~weekdays}

    slot_masks, trade_masks = masks(slot_local), masks(entry_local)
    slot_offset = (slot_local - slots) // hour_ms
    trade_offset = (entry_local - np.asarray([t.entry_time for t in trades], np.int64)) // hour_ms if trades else entry_local

    def period_row(key: str, slot_mask, trade_mask, offset=None) -> dict:
        group = [t for t, keep in zip(trades, trade_mask) if keep]
        hours = int(np.count_nonzero(slot_mask))
        row = {"period": key, "hours": hours, **summary(group),
               "perHundred": _round(len(group) / hours * 100, 2) if hours else None}
        if offset is not None:
            row["offset"] = offset
        return row

    periods = [period_row(key, slot_masks[key], trade_masks[key]) for key in ("work", "evening", "night", "weekend")]
    for offset in sorted({int(v) for v in slot_offset}):
        periods.append(period_row("offset", slot_offset == offset, trade_offset == offset, offset))
    work = [t for t, keep in zip(trades, trade_masks["work"]) if keep]
    off = [t for t, keep in zip(trades, trade_masks["work"]) if not keep]
    return {
        "worldSessions": {**head, "rows": sessions},
        "workHours": {**head, "rows": periods, "workPnl": _round(sum(t.pnl for t in work), 2),
                      "offPnl": _round(sum(t.pnl for t in off), 2)},
        "sessionEdges": {**head, "rows": edges},
    }

"""5.3 — Dias da semana."""

from __future__ import annotations

import numpy as np

from ..columns import VERSION
from ..common import DAY_MS, SAMPLE_MIN_TRADES, STOP_EXIT, _round


# Os dias da semana, 0 = segunda; segunda a sexta é a semana
WEEK_DAYS = range(0, 5)


def _weekday(local_ms: int) -> int:
    """O dia da semana de um instante local (0 = segunda; 1/1/1970 foi quinta)."""
    return (local_ms // DAY_MS + 3) % 7


def _stop_streak(group) -> int:
    """A maior série de stops seguidos nos trades de um grupo, pela entrada."""
    best = run = 0
    for trade in sorted(group, key=lambda t: t.entry_time):
        run = run + 1 if trade.exit_reason == STOP_EXIT else 0
        best = max(best, run)
    return best


def weekdays_report(trades, entries: list[dict], local, zone: str, start_ms: int, end_ms: int) -> dict:
    """5.3 — Dias da semana, pelo dia local (com a mudança de hora) em que o
    trade abriu: os 6 cartões, os trades de cada dia por entrada, os stops pelo
    dia de entrada e pelo de saída, o P&L, a tabela e, por entrada, os stops, os
    ganhos e o P&L de cada dia. Os trades por dia dividem pelos dias desse tipo
    no período (de `start_ms` a `end_ms`)."""
    entry_day = [_weekday(int(v)) for v in np.asarray(local([t.entry_time for t in trades]), np.int64)] if trades else []
    exit_day = [_weekday(int(v)) for v in np.asarray(local([t.exit_time for t in trades]), np.int64)] if trades else []
    first, last = int(local(start_ms)) // DAY_MS, int(local(end_ms)) // DAY_MS
    days = [0] * 7
    for day in range(first, last + 1):
        days[(day + 3) % 7] += 1

    own = [[] for _ in range(7)]
    exit_stops = [0] * 7
    for trade, day, out in zip(trades, entry_day, exit_day):
        own[day].append(trade)
        exit_stops[out] += trade.exit_reason == STOP_EXIT

    def pct(part, whole):
        return _round(part / whole * 100, 2) if whole else None

    def summary(group):
        n = len(group)
        rs = [t.r for t in group if t.r is not None]
        stops = sum(1 for t in group if t.exit_reason == STOP_EXIT)
        wins = sum(1 for t in group if t.pnl > 0)
        pnl = sum(t.pnl for t in group)
        return {
            "trades": n,
            "wins": wins,
            "stops": stops,
            "pnl": pnl,
            "avgR": _round(sum(rs) / len(rs), 3) if rs else None,
            "winRatePct": pct(wins, n),
            "stopsPct": pct(stops, n),
        }

    rows = [summary(group) for group in own]
    used = [day for day in range(7) if rows[day]["trades"]]
    busiest = max(used, key=lambda d: (rows[d]["trades"], -d), default=None)
    stopped = [d for d in used if rows[d]["stops"]]
    most_stops = max(stopped, key=lambda d: (rows[d]["stops"] / rows[d]["trades"], -d), default=None)
    best = max(used, key=lambda d: rows[d]["pnl"], default=None)
    worst = min(used, key=lambda d: rows[d]["pnl"], default=None)

    def part(day_range):
        group = [t for d in day_range for t in own[d]]
        row = summary(group)
        return {"trades": row["trades"], "pnl": _round(row["pnl"], 2), "winRatePct": row["winRatePct"],
                "stopsPct": row["stopsPct"]}

    cards = {
        "version": VERSION,
        "timezone": zone,
        "busiest": {"day": busiest, "trades": rows[busiest]["trades"],
                    "perDay": _round(rows[busiest]["trades"] / days[busiest], 2) if days[busiest] else None}
        if busiest is not None else None,
        "mostStops": {"day": most_stops, "stopsPct": rows[most_stops]["stopsPct"], "stops": rows[most_stops]["stops"]}
        if most_stops is not None else None,
        "best": {"day": best, "pnl": _round(rows[best]["pnl"], 2), "avgR": rows[best]["avgR"]} if best is not None else None,
        "worst": {"day": worst, "pnl": _round(rows[worst]["pnl"], 2), "avgR": rows[worst]["avgR"]}
        if worst is not None else None,
        "week": part(WEEK_DAYS),
        "weekend": part(range(5, 7)),
    }

    rules = sorted(set(range(1, len(entries) + 1)) | {t.entry_rule for t in trades})
    counts = {rule: [0] * 7 for rule in rules}
    stops = {rule: [0] * 7 for rule in rules}
    wins = {rule: [0] * 7 for rule in rules}
    pnl = {rule: [0.0] * 7 for rule in rules}
    for trade, day in zip(trades, entry_day):
        counts[trade.entry_rule][day] += 1
        stops[trade.entry_rule][day] += trade.exit_reason == STOP_EXIT
        wins[trade.entry_rule][day] += trade.pnl > 0
        pnl[trade.entry_rule][day] += trade.pnl

    table = []
    for day in range(7):
        row, group = rows[day], own[day]
        n = row["trades"]
        bars = [t.bars for t in group if t.bars is not None]
        # A melhor e a pior entrada do dia pelo P&L (a pior só com mais de uma)
        traded = [rule for rule in rules if counts[rule][day]]
        top = max(traded, key=lambda rule: (pnl[rule][day], -rule), default=None)
        low = min(traded, key=lambda rule: (pnl[rule][day], rule), default=None)
        table.append({
            "day": day,
            "days": days[day],
            "trades": n,
            "perDay": _round(n / days[day], 2) if days[day] else None,
            "winRatePct": row["winRatePct"],
            "stops": row["stops"],
            "stopsPct": row["stopsPct"],
            "exitStops": exit_stops[day],
            "pnl": _round(row["pnl"], 2),
            "expectancy": _round(row["pnl"] / n, 2) if n else None,
            "avgR": row["avgR"],
            "avgBars": _round(sum(bars) / len(bars), 2) if bars else None,
            "worstStreak": _stop_streak(group),
            "bestEntry": {"rule": top, "pnl": _round(pnl[top][day], 2)} if top is not None else None,
            "worstEntry": {"rule": low, "pnl": _round(pnl[low][day], 2)} if len(traded) > 1 else None,
        })

    def head():
        return {"version": VERSION, "timezone": zone}

    return {
        "weekdayCards": cards,
        "weekdayEntries": {**head(), "entries": [{"rule": r, "counts": counts[r]} for r in rules],
                           "totals": [row["trades"] for row in rows]},
        "weekdayStops": {**head(), "columns": ["day", "entryStops", "exitStops"],
                         "days": [[day, rows[day]["stops"], exit_stops[day]] for day in range(7)]},
        "weekdayPnl": {**head(), "minTrades": SAMPLE_MIN_TRADES, "columns": ["day", "trades", "pnl", "winRate", "avgR"],
                       "days": [[day, rows[day]["trades"], _round(rows[day]["pnl"], 2), rows[day]["winRatePct"],
                                 rows[day]["avgR"]] for day in range(7)]},
        "weekdayTable": {**head(), "rows": table},
        "weekdayEntryStops": {**head(), "entries": [{"rule": r, "counts": stops[r]} for r in rules]},
        "weekdayEntryWins": {**head(), "entries": [{"rule": r, "counts": wins[r]} for r in rules]},
        "weekdayEntryPnl": {**head(), "entries": [{"rule": r, "pnl": [_round(v, 2) for v in pnl[r]]} for r in rules]},
    }

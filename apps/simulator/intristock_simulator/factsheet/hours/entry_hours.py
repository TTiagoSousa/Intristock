"""5.1 — Horas de entrada, na hora local da simulação."""

from __future__ import annotations

import numpy as np

from ..columns import VERSION
from ..common import SAMPLE_MIN_TRADES, STOP_EXIT, _round


# --- 5. Horários ---------------------------------------------------------------

# A sessão do mercado de cada hora local (as horas de Lisboa): Ásia até às 8h,
# Europa até às 14h, Europa e EUA juntas até às 17h, EUA até às 22h e a noite
HOUR_SESSIONS = ["asia"] * 8 + ["europe"] * 6 + ["overlap"] * 3 + ["us"] * 5 + ["night"] * 2


def _hour_table(trades, entry_hours, rows: list[dict], zone: str) -> dict:
    """5.1 — Uma linha por hora de entrada (as 24): a sessão, os trades e a %
    do total, longs e shorts, win rate, stops e a %, P&L, expectancy (P&L
    médio), R médio (dos trades com stop), velas médias e a entrada que mais
    abriu nessa hora (empate: a primeira)."""
    total = len(trades)
    own = [[] for _ in range(24)]
    for trade, hour in zip(trades, entry_hours):
        own[int(hour)].append(trade)
    table = []
    for hour, row in enumerate(rows):
        group = own[hour]
        rs = [t.r for t in group if t.r is not None]
        bars = [t.bars for t in group if t.bars is not None]
        counts = {}
        for trade in group:
            counts[trade.entry_rule] = counts.get(trade.entry_rule, 0) + 1
        top = min(counts, key=lambda rule: (-counts[rule], rule)) if counts else None
        n = row["trades"]
        table.append({
            "hour": hour,
            "session": HOUR_SESSIONS[hour],
            "trades": n,
            "pct": _round(n / total * 100, 2) if total else None,
            "longs": sum(1 for t in group if t.side == "long"),
            "shorts": sum(1 for t in group if t.side != "long"),
            "winRatePct": _round(row["wins"] / n * 100, 2) if n else None,
            "stops": row["stops"],
            "stopsPct": _round(row["stops"] / n * 100, 2) if n else None,
            "pnl": _round(row["pnl"], 2),
            "expectancy": _round(row["pnl"] / n, 2) if n else None,
            "avgR": _round(sum(rs) / len(rs), 3) if rs else None,
            "avgBars": _round(sum(bars) / len(bars), 2) if bars else None,
            "topEntry": {"rule": top, "trades": counts[top]} if top is not None else None,
        })
    return {"version": VERSION, "timezone": zone, "rows": table}


def _hour_rows(trades, entry_hours: np.ndarray) -> list[dict]:
    """As 24 horas (locais) pela hora de entrada: trades, stops (fecharam em
    stop loss, fosse quando fosse), ganhos e o P&L líquido."""
    rows = [{"hour": hour, "trades": 0, "stops": 0, "wins": 0, "pnl": 0.0} for hour in range(24)]
    for trade, hour in zip(trades, entry_hours):
        row = rows[int(hour)]
        row["trades"] += 1
        row["stops"] += trade.exit_reason == STOP_EXIT
        row["wins"] += trade.pnl > 0
        row["pnl"] += trade.pnl
    return rows


def hours_report(trades, entries: list[dict], local, zone: str) -> dict:
    """5.1 — Horas de entrada, na hora local da simulação (`local` passa um
    instante UTC em ms para o mesmo relógio no fuso dela, com a mudança de
    hora): os 6 cartões, os trades de cada hora por entrada, os stops e o P&L.
    Os stops contam-se pela hora em que o trade abriu (o cartão «hora de saída»
    conta-os pela hora em que fecharam)."""
    hour_ms = 3_600_000
    entry_hours = (np.asarray(local([t.entry_time for t in trades]), np.int64) // hour_ms) % 24 if trades else []
    exit_hours = (np.asarray(local([t.exit_time for t in trades]), np.int64) // hour_ms) % 24 if trades else []
    rows = _hour_rows(trades, entry_hours)
    total = len(trades)
    used = [row for row in rows if row["trades"]]
    stops_on_exit = [0] * 24
    for trade, hour in zip(trades, exit_hours):
        if trade.exit_reason == STOP_EXIT:
            stops_on_exit[int(hour)] += 1

    def pct(part, whole):
        return _round(part / whole * 100, 2) if whole else None

    busiest = max(used, key=lambda row: row["trades"], default=None)
    most_stops = max(used, key=lambda row: row["stops"], default=None)
    exit_peak = max(range(24), key=lambda hour: stops_on_exit[hour]) if any(stops_on_exit) else None
    best = max(used, key=lambda row: row["pnl"], default=None)
    worst = min(used, key=lambda row: row["pnl"], default=None)
    cards = {
        "version": VERSION,
        "timezone": zone,
        "trades": total,
        "busiest": {"hour": busiest["hour"], "trades": busiest["trades"], "pct": pct(busiest["trades"], total)} if busiest else None,
        "mostStopsEntry": {"hour": most_stops["hour"], "stops": most_stops["stops"], "trades": most_stops["trades"]}
        if most_stops and most_stops["stops"] else None,
        "mostStopsExit": {"hour": exit_peak, "stops": stops_on_exit[exit_peak]} if exit_peak is not None else None,
        "best": {"hour": best["hour"], "pnl": _round(best["pnl"], 2), "winRate": pct(best["wins"], best["trades"])} if best else None,
        "worst": {"hour": worst["hour"], "pnl": _round(worst["pnl"], 2), "stopsPct": pct(worst["stops"], worst["trades"])}
        if worst else None,
        "emptyHours": [row["hour"] for row in rows if not row["trades"]],
    }

    # As entradas da estratégia (e alguma regra a mais que apareça nos trades)
    rules = sorted(set(range(1, len(entries) + 1)) | {t.entry_rule for t in trades})
    counts = {rule: [0] * 24 for rule in rules}
    for trade, hour in zip(trades, entry_hours):
        counts[trade.entry_rule][int(hour)] += 1
    by_entry = {
        "version": VERSION,
        "timezone": zone,
        "entries": [{"rule": rule, "counts": counts[rule]} for rule in rules],
        "totals": [row["trades"] for row in rows],
    }
    stops = {
        "version": VERSION,
        "timezone": zone,
        "columns": ["hour", "trades", "stops", "stopsPct"],
        "hours": [[row["hour"], row["trades"], row["stops"], pct(row["stops"], row["trades"])] for row in rows],
    }
    pnl = {
        "version": VERSION,
        "timezone": zone,
        "minTrades": SAMPLE_MIN_TRADES,
        "columns": ["hour", "trades", "pnl", "winRate"],
        "hours": [[row["hour"], row["trades"], _round(row["pnl"], 2), pct(row["wins"], row["trades"])] for row in rows],
    }
    return {
        "hourCards": cards,
        "hourEntries": by_entry,
        "hourStops": stops,
        "hourPnl": pnl,
        "hourTable": _hour_table(trades, entry_hours, rows, zone),
    }

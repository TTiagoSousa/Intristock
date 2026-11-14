"""5.2 — Horas de saída."""

from __future__ import annotations

import math

import numpy as np

from ..columns import VERSION
from ..common import DAY_MS, STOP_EXIT, _round


# A ordem dos motivos de saída na 5.2 (os outros que apareçam vão no fim)
EXIT_HOUR_REASONS = ["stop_loss", "trailing_stop", "break_even", "take_profit", "signal", "time",
                     "liquidation", "opposite", "excluded", "end"]
# As saídas que contam como «a ganhar» (com P&L positivo)
WIN_EXITS = ["take_profit", "trailing_stop", "break_even"]
# A madrugada, nas horas locais: das 0h às 7h (pouca liquidez)
NIGHT_HOURS = range(0, 7)


def _mean_hour(local_ms: list[int]) -> int | None:
    """A hora média num relógio de 24 h (média circular: 23h e 1h dão 0h);
    nula sem horas ou quando se anulam."""
    if not local_ms:
        return None
    angles = [(ms % DAY_MS) / DAY_MS * 2 * math.pi for ms in local_ms]
    x, y = sum(math.cos(a) for a in angles), sum(math.sin(a) for a in angles)
    if math.hypot(x, y) < 1e-9 * len(angles):
        return None
    return int(round((math.atan2(y, x) % (2 * math.pi)) / (2 * math.pi) * 24)) % 24


def exit_hours_report(trades, entries: list[dict], local, zone: str) -> dict:
    """5.2 — Horas de saída, na hora local da simulação: os trades fechados em
    cada hora por motivo, os stops por hora de saída (com a madrugada marcada),
    as saídas a ganhar (take profit, trailing e break-even com P&L positivo) e,
    por entrada, onde lhe cai o stop: as 3 horas com mais stops, as horas
    médias de entrada e de saída desses stops, a hora com mais saídas a ganhar,
    os stops na 1.ª hora depois da entrada e os de madrugada."""
    hour_ms = 3_600_000
    entry_local = [int(v) for v in np.asarray(local([t.entry_time for t in trades]), np.int64)] if trades else []
    exit_local = [int(v) for v in np.asarray(local([t.exit_time for t in trades]), np.int64)] if trades else []
    exit_hour = [(ms // hour_ms) % 24 for ms in exit_local]

    present = {t.exit_reason for t in trades}
    reasons = [r for r in EXIT_HOUR_REASONS if r in present] + sorted(present - set(EXIT_HOUR_REASONS))
    counts = {reason: [0] * 24 for reason in reasons}
    stops = [0] * 24
    wins = {reason: [0] * 24 for reason in WIN_EXITS}
    for trade, hour in zip(trades, exit_hour):
        counts[trade.exit_reason][hour] += 1
        if trade.exit_reason == STOP_EXIT:
            stops[hour] += 1
        if trade.exit_reason in WIN_EXITS and trade.pnl > 0:
            wins[trade.exit_reason][hour] += 1

    by_reason = {
        "version": VERSION,
        "timezone": zone,
        "reasons": [{"reason": reason, "counts": counts[reason]} for reason in reasons],
        "totals": [sum(counts[r][hour] for r in reasons) for hour in range(24)],
    }
    stop_hours = {
        "version": VERSION,
        "timezone": zone,
        "nightHours": list(NIGHT_HOURS),
        "columns": ["hour", "stops"],
        "hours": [[hour, stops[hour]] for hour in range(24)],
    }
    win_hours = {
        "version": VERSION,
        "timezone": zone,
        "columns": ["hour", "wins", "takeProfit", "trailingStop", "breakEven"],
        "hours": [[hour, sum(wins[r][hour] for r in WIN_EXITS), wins["take_profit"][hour],
                   wins["trailing_stop"][hour], wins["break_even"][hour]] for hour in range(24)],
    }

    rows = []
    for rule in sorted({t.entry_rule for t in trades}):
        own = [i for i, t in enumerate(trades) if t.entry_rule == rule]
        stopped = [i for i in own if trades[i].exit_reason == STOP_EXIT]
        won = [i for i in own if trades[i].exit_reason in WIN_EXITS and trades[i].pnl > 0]
        per_hour = [0] * 24
        for i in stopped:
            per_hour[exit_hour[i]] += 1
        # As 3 horas com mais stops (empate: a mais cedo)
        top = sorted((h for h in range(24) if per_hour[h]), key=lambda h: (-per_hour[h], h))[:3]
        win_hour = [0] * 24
        for i in won:
            win_hour[exit_hour[i]] += 1
        best_win = min((h for h in range(24) if win_hour[h]), key=lambda h: (-win_hour[h], h), default=None)
        first_hour = sum(1 for i in stopped if trades[i].exit_time - trades[i].entry_time <= hour_ms)
        night = sum(1 for i in stopped if exit_hour[i] in NIGHT_HOURS)
        n = len(stopped)
        rows.append({
            "rule": rule,
            "trades": len(own),
            "stops": n,
            "topStopHours": [{"hour": h, "stops": per_hour[h]} for h in top],
            "avgEntryHour": _mean_hour([entry_local[i] for i in stopped]),
            "avgExitHour": _mean_hour([exit_local[i] for i in stopped]),
            "topWinHour": {"hour": best_win, "trades": win_hour[best_win]} if best_win is not None else None,
            "firstHourStops": first_hour,
            "firstHourPct": _round(first_hour / n * 100, 2) if n else None,
            "nightStops": night,
            "nightPct": _round(night / n * 100, 2) if n else None,
        })
    by_entry = {"version": VERSION, "timezone": zone, "nightHours": list(NIGHT_HOURS), "rows": rows}
    return {"exitHours": by_reason, "exitHourStops": stop_hours, "exitHourWins": win_hours, "exitHourEntries": by_entry}

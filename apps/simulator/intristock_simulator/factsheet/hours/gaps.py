"""5.9 — Sessões, fins de semana e gaps (em UTC)."""

from __future__ import annotations

from datetime import datetime, timezone

import numpy as np

from ...market.candles import Candles
from ..columns import VERSION
from ..common import DAY_MS, STOP_EXIT, _mean, _round


# 5.9: a vela que conta como gap (a primeira hora de cada dia UTC)
GAP_HOUR_MS = 3_600_000


def gaps_report(trades, entries: list[dict], minutes: Candles, start_ms: int, end_ms: int, rules: list[dict]) -> dict:
    """5.9 — Sessões, fins de semana e gaps (em UTC): a variação da primeira
    hora de cada dia (o «gap» da cripto), os trades pelo que atravessam (fecham
    no mesmo dia UTC, atravessam a vela diária, atravessam o fim de semana — os
    três separados — e compras, vendas e todos), com os stops e os que saíram
    com gap (a vela do minuto da saída abriu para lá do nível do stop), e as
    regras de sessão corridas no motor (`rules`, já feitas)."""
    first_day = start_ms // DAY_MS + (1 if start_ms % DAY_MS else 0)
    last_day = (end_ms - 1) // DAY_MS
    days, moves = [], []
    for day in range(first_day, last_day + 1):
        begin = day * DAY_MS
        lo = int(np.searchsorted(minutes.time, begin, side="left"))
        hi = int(np.searchsorted(minutes.time, begin + GAP_HOUR_MS, side="left"))
        if hi <= lo or int(minutes.time[lo]) >= begin + GAP_HOUR_MS:
            continue
        opened = float(minutes.open[lo])
        if opened <= 0:
            continue
        days.append(day)
        moves.append((float(minutes.close[hi - 1]) / opened - 1) * 100)
    sizes = [abs(v) for v in moves]
    monday = [abs(v) for d, v in zip(days, moves) if (d + 3) % 7 == 0]
    biggest = int(np.argmax(sizes)) if sizes else None

    def date_of(day: int) -> str:
        return datetime.fromtimestamp(day * DAY_MS / 1000, timezone.utc).date().isoformat()

    # Os stops que saíram com gap: o minuto da saída abriu para lá do nível do stop
    gap_stops, gap_cost = set(), 0.0
    for trade in trades:
        if trade.exit_reason != STOP_EXIT:
            continue
        level = trade.stop_level
        if level is None:
            continue
        direction = 1 if trade.side == "long" else -1
        at = min(int(np.searchsorted(minutes.time, trade.exit_time, side="left")), len(minutes) - 1)
        if direction * (float(minutes.open[at]) - level) < 0:
            gap_stops.add(id(trade))
            gap_cost += direction * (level - trade.exit_price) * trade.quantity

    def crosses_weekend(trade) -> bool:
        # Abriu antes e fechou depois de uma meia-noite UTC de sábado, domingo ou segunda
        first = trade.entry_time // DAY_MS + 1
        last = (trade.exit_time - 1) // DAY_MS if trade.exit_time > trade.entry_time else first - 1
        return any((day + 3) % 7 in (5, 6, 0) for day in range(first, min(last, first + 6) + 1))

    def kind(trade) -> str:
        if trade.exit_time // DAY_MS == trade.entry_time // DAY_MS:
            return "sameDay"
        return "weekend" if crosses_weekend(trade) else "daily"

    kinds = [kind(t) for t in trades]

    def group_row(key: str, group) -> dict:
        stops = [t for t in group if t.exit_reason == STOP_EXIT]
        return {"group": key, "trades": len(group), "pnl": _round(sum(t.pnl for t in group), 2), "stops": len(stops),
                "stopsPct": _round(len(stops) / len(group) * 100, 2) if group else None,
                "gapStops": sum(1 for t in stops if id(t) in gap_stops)}

    groups = [
        group_row("sameDay", [t for t, k in zip(trades, kinds) if k == "sameDay"]),
        group_row("daily", [t for t, k in zip(trades, kinds) if k == "daily"]),
        group_row("weekend", [t for t, k in zip(trades, kinds) if k == "weekend"]),
        group_row("long", [t for t in trades if t.side == "long"]),
        group_row("short", [t for t in trades if t.side == "short"]),
        group_row("all", trades),
    ]
    crossing = sum(1 for k in kinds if k != "sameDay")
    head = {"version": VERSION, "timezone": "UTC"}
    return {
        "gapCards": {
            **head,
            "days": len(days),
            "mondays": len(monday),
            "meanAbsPct": _round(_mean(sizes), 4),
            "biggest": {"date": date_of(days[biggest]), "pct": _round(moves[biggest], 4)} if biggest is not None else None,
            "crossing": crossing,
            "crossingPct": _round(crossing / len(trades) * 100, 2) if trades else None,
            "weekend": sum(1 for k in kinds if k == "weekend"),
            "gapStops": len(gap_stops),
            "gapCost": _round(gap_cost, 2),
        },
        "gapDaily": {**head, "columns": ["date", "pct"], "days": [[date_of(d), _round(v, 4)] for d, v in zip(days, moves)],
                     "meanAbsPct": _round(_mean(sizes), 4), "mondayMeanAbsPct": _round(_mean(monday), 4),
                     "maxAbsPct": _round(max(sizes), 4) if sizes else None},
        "passageGroups": {**head, "rows": groups},
        "sessionRules": {**head, "rows": rules},
    }

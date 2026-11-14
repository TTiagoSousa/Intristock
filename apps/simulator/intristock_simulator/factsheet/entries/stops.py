"""4.3 e 4.4 — Stops e saídas, e o que o preço fez depois de sair."""

from __future__ import annotations

from datetime import datetime, timezone

import numpy as np

from ...market.candles import Bars, Candles
from ..columns import VERSION
from ..common import STOP_EXIT, _initial_stop, _mean, _round, _win_rate
from ..summary.returns import _month_start


# 4.3: quanto tempo depois de um stop se vê se o preço chegou ao take
REVERSAL_MS = 48 * 60 * 60 * 1000
# 4.4: as velas depois da saída e o movimento que conta como "continuou"
AFTER_EXIT_BARS = (6, 24, 72)
AFTER_EXIT_KINDS = ("take_profit", "stop_loss", "trailing_stop")
CONTINUED_PCT = 2.0


def _stop_streaks(paths: list[dict]) -> list[int]:
    """O tamanho de cada sequência de stops seguidos (pela ordem de saída)."""
    streaks, run = [], 0
    for path in paths:
        if _initial_stop(path["trade"]):
            run += 1
        elif run:
            streaks.append(run)
            run = 0
    if run:
        streaks.append(run)
    return streaks


def stop_cards(paths: list[dict], minutes: Candles) -> dict:
    """4.3 — Os 8 cartões: stops (e % dos trades), stops ÷ trades a perder, os
    que reverteram (o preço chegou ao take dessa entrada até 48 h depois da
    saída), o custo extra (a saída pior do que o nível do stop, em %: gaps e
    slippage), as velas até ao stop, a maior sequência de stops, os
    break-evens e os takes (e % dos trades)."""
    stops = [p for p in paths if _initial_stop(p["trade"])]
    losses = sum(1 for p in paths if p["trade"].pnl <= 0)
    reversed_count = 0
    extra = []
    for path in stops:
        trade = path["trade"]
        if path["stopLevel"]:
            extra.append(path["direction"] * (path["stopLevel"] - trade.exit_price) / path["stopLevel"] * 100)
        if path["takeLevel"] is None:
            continue
        first = path["exitMinute"] + 1
        last = int(np.searchsorted(minutes.time, trade.exit_time + REVERSAL_MS, side="right"))
        if last <= first:
            continue
        if path["direction"] == 1:
            reached = float(minutes.high[first:last].max()) >= path["takeLevel"]
        else:
            reached = float(minutes.low[first:last].min()) <= path["takeLevel"]
        reversed_count += int(reached)
    takes = sum(1 for p in paths if p["trade"].exit_reason == "take_profit")
    count = len(paths)
    return {
        "version": VERSION,
        "stops": len(stops),
        "stopsPct": _round(len(stops) / count * 100, 2) if count else None,
        "stopsOfLossesPct": _round(len(stops) / losses * 100, 2) if losses else None,
        "reversed": reversed_count,
        "reversedPct": _round(reversed_count / len(stops) * 100, 2) if stops else None,
        "reversalHours": REVERSAL_MS // 3_600_000,
        "extraCostPct": _round(_mean(extra), 4),
        "barsToStop": _round(_mean(p["bars"] for p in stops), 2),
        "maxStreak": max(_stop_streaks(paths), default=0),
        "breakEvens": sum(1 for p in paths if p["trade"].exit_reason == "break_even"),
        "takes": takes,
        "takesPct": _round(takes / count * 100, 2) if count else None,
    }


def exit_reasons(paths: list[dict], columns: list[dict]) -> dict:
    """4.3 — Por motivo de saída (as colunas da 4.2): trades, % deles, win rate,
    P&L médio e total, velas e o deixado na mesa (MFE médio − movimento médio
    até à saída, em % do preço)."""
    count = len(paths)
    rows = []
    for column in columns:
        own = [p for p in paths if p["exitKey"] == column["key"]]
        trades = [p["trade"] for p in own]
        pnl = float(sum(t.pnl for t in trades))
        mfe, move = _mean(p["mfePct"] for p in own), _mean(p["movePct"] for p in own)
        rows.append({
            "key": column["key"],
            "trades": len(own),
            "pct": _round(len(own) / count * 100, 2) if count else None,
            "winRatePct": _round(_win_rate(trades), 2),
            "avgPnl": _round(pnl / len(own), 4) if own else None,
            "pnl": _round(pnl, 2),
            "avgBars": _round(_mean(p["bars"] for p in own), 2),
            "leftOnTablePct": _round(mfe - move, 4) if mfe is not None and move is not None else None,
        })
    return {"version": VERSION, "columns": columns, "rows": rows}


def stops_by_month(paths: list[dict], start_ms: int, end_ms: int) -> dict:
    """4.3 — Stops por mês (UTC, todos os meses do período, com os vazios), a
    média por mês e quantas vezes houve N stops seguidos."""
    start, end = datetime.fromtimestamp(start_ms / 1000, timezone.utc), datetime.fromtimestamp(end_ms / 1000, timezone.utc)
    months, year, month = [], start.year, start.month
    while (year, month) <= (end.year, end.month):
        months.append([_month_start(year, month), 0])
        year, month = (year + 1, 1) if month == 12 else (year, month + 1)
    for path in paths:
        if not _initial_stop(path["trade"]):
            continue
        moment = datetime.fromtimestamp(path["trade"].exit_time / 1000, timezone.utc)
        position = (moment.year - start.year) * 12 + moment.month - start.month
        if 0 <= position < len(months):
            months[position][1] += 1
    streaks = _stop_streaks(paths)
    longest = max(streaks, default=0)
    return {
        "version": VERSION,
        "columns": ["month", "stops"],
        "months": months,
        "avgPerMonth": _round(sum(m[1] for m in months) / len(months), 3) if months else None,
        "streaks": [{"length": n, "count": streaks.count(n)} for n in range(1, longest + 1)],
    }


def after_exit(paths: list[dict], bars: Bars, minutes: Candles) -> dict:
    """4.4 — Depois da saída, nas velas `AFTER_EXIT_BARS` (do tempo gráfico) a
    seguir à do take, do stop e do trailing: o movimento médio a favor do
    trade (do preço de saída ao fecho da vela N), a % em que continuou +2% a
    favor nesse tempo, a % em que voltou ao preço de entrada (take e
    trailing, dos que saíram com o preço a favor) e, nos stops, a % em que chegou ao take dessa entrada (os stops
    sem take não contam)."""
    tables = []
    for kind in AFTER_EXIT_KINDS:
        own = [p for p in paths if p["trade"].exit_reason == kind and (kind != STOP_EXIT or _initial_stop(p["trade"]))]
        rows = []
        for horizon in AFTER_EXIT_BARS:
            moves, continued, returned, ahead, reached, with_take = [], 0, 0, 0, 0, 0
            for path in own:
                trade, direction = path["trade"], path["direction"]
                bar = path["exitBar"] + horizon
                if bar >= len(bars):
                    continue
                first = path["exitMinute"] + 1
                last = int(bars.first_minute[bar + 1]) if bar + 1 < len(bars) else len(minutes)
                if last <= first:
                    continue
                high, low = float(minutes.high[first:last].max()), float(minutes.low[first:last].min())
                exit_price = trade.exit_price
                moves.append(direction * (float(bars.close[bar]) / exit_price - 1) * 100)
                best = (high / exit_price - 1) * 100 if direction == 1 else (1 - low / exit_price) * 100
                continued += int(best >= CONTINUED_PCT)
                # Voltar à entrada só conta nos que saíram com o preço do lado a favor
                if direction * (exit_price - trade.entry_price) > 0:
                    ahead += 1
                    back = low <= trade.entry_price if direction == 1 else high >= trade.entry_price
                    returned += int(back)
                if path["takeLevel"] is not None:
                    with_take += 1
                    hit = high >= path["takeLevel"] if direction == 1 else low <= path["takeLevel"]
                    reached += int(hit)
            seen = len(moves)
            rows.append({
                "bars": horizon,
                "trades": seen,
                "avgMovePct": _round(_mean(moves), 4),
                "continuedPct": _round(continued / seen * 100, 2) if seen else None,
                "returnedPct": _round(returned / ahead * 100, 2) if ahead and kind != STOP_EXIT else None,
                "reachedTakePct": _round(reached / with_take * 100, 2) if with_take and kind == STOP_EXIT else None,
            })
        tables.append({"kind": kind, "trades": len(own), "rows": rows})
    return {"version": VERSION, "continuedPct": CONTINUED_PCT, "tables": tables}

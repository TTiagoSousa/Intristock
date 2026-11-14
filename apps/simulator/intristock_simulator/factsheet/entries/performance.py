"""4.1 e 4.2 — Cada entrada e cada par entrada → saída."""

from __future__ import annotations

from ..columns import VERSION
from ..common import _initial_stop, _mean, _payoff, _profit_factor, _round, _win_rate


def entry_performance(paths: list[dict], entries: list[dict], split_ms: int, current_return: float,
                      without: dict[int, float]) -> dict:
    """4.1 — Por entrada: trades, win rate, payoff (ganho médio ÷ perda média),
    PF, expectancy (P&L médio), R médio, P&L, % do lucro (do P&L de todas),
    velas abertas em média, % de stops, o R médio dentro e fora da amostra
    (pela entrada) e o retorno da estratégia sem esta entrada (o motor outra
    vez, `without`; nulo com uma só entrada)."""
    total = sum(p["trade"].pnl for p in paths)
    rows = []
    for index, entry in enumerate(entries, start=1):
        own = [p for p in paths if p["rule"] == index]
        trades = [p["trade"] for p in own]
        pnl = float(sum(t.pnl for t in trades))
        inside = [p["r"] for p in own if p["trade"].entry_time < split_ms]
        outside = [p["r"] for p in own if p["trade"].entry_time >= split_ms]
        rows.append({
            "rule": index,
            "side": entry["side"],
            "trades": len(trades),
            "winRatePct": _round(_win_rate(trades), 2),
            "payoff": _round(_payoff(trades), 3),
            "profitFactor": _round(_profit_factor(trades), 3),
            "expectancy": _round(pnl / len(trades), 4) if trades else None,
            "avgR": _round(_mean(p["r"] for p in own), 4),
            "pnl": _round(pnl, 2),
            "profitSharePct": _round(pnl / total * 100, 2) if trades and abs(total) > 1e-9 else None,
            "avgBars": _round(_mean(p["bars"] for p in own), 2),
            "stopsPct": _round(sum(1 for p in own if _initial_stop(p["trade"])) / len(own) * 100, 2)
            if own else None,
            "insideR": _round(_mean(inside), 4),
            "outsideR": _round(_mean(outside), 4),
            "withoutReturnPct": _round(without.get(index), 2),
        })
    return {"version": VERSION, "currentReturnPct": _round(current_return, 2), "splitTime": int(split_ms), "rows": rows}


def entry_cards(performance: dict) -> dict:
    """4.1 — Os 6 cartões: a melhor e a pior entrada (pelo P&L, com o R médio),
    as entradas a perder, as que mudam de sinal fora da amostra (o R médio
    positivo numa parte e negativo na outra), longs e shorts e o retorno ao
    desligar a pior (contra o atual)."""
    rows = [row for row in performance["rows"] if row["trades"]]
    best = max(rows, key=lambda row: row["pnl"], default=None)
    worst = min(rows, key=lambda row: row["pnl"], default=None)
    flips = sum(
        1 for row in rows
        if row["insideR"] is not None and row["outsideR"] is not None and row["insideR"] * row["outsideR"] < 0
    )

    def pick(row):
        return {"rule": row["rule"], "pnl": row["pnl"], "avgR": row["avgR"]} if row else None

    return {
        "version": VERSION,
        "best": pick(best),
        "worst": pick(worst) if worst and len(rows) > 1 else None,
        "losing": sum(1 for row in rows if row["pnl"] < 0),
        "entries": len(performance["rows"]),
        "flips": flips,
        "longs": sum(row["trades"] for row in performance["rows"] if row["side"] == "long"),
        "shorts": sum(row["trades"] for row in performance["rows"] if row["side"] == "short"),
        "withoutWorst": {
            "rule": worst["rule"],
            "returnPct": worst["withoutReturnPct"],
            "currentReturnPct": performance["currentReturnPct"],
        } if worst and len(rows) > 1 and worst["withoutReturnPct"] is not None else None,
    }


def entry_equity(paths: list[dict], entries: list[dict], start_ms: int, end_ms: int) -> dict:
    """4.1 — Equity por entrada: o P&L acumulado de cada entrada, um ponto em
    cada saída (mais o início e o fim)."""
    series = []
    for index in range(1, len(entries) + 1):
        total, points = 0.0, [[int(start_ms), 0.0]]
        for path in paths:
            if path["rule"] == index:
                total += path["trade"].pnl
                points.append([int(path["trade"].exit_time), round(total, 2)])
        points.append([int(end_ms), round(total, 2)])
        series.append({"rule": index, "total": round(total, 2), "points": points})
    return {"version": VERSION, "columns": ["time", "pnl"], "series": series}


def entry_exit_matrix(paths: list[dict], entries: list[dict], columns: list[dict]) -> dict:
    """4.2 — Entrada → saída: em cada par, os trades, a win rate, o P&L total e
    o médio (a cor da célula); nulo onde a entrada nunca saiu por ali."""
    rows = []
    for index in range(1, len(entries) + 1):
        cells = []
        for column in columns:
            own = [p["trade"] for p in paths if p["rule"] == index and p["exitKey"] == column["key"]]
            pnl = float(sum(t.pnl for t in own))
            cells.append({
                "trades": len(own),
                "winRatePct": _round(_win_rate(own), 2),
                "pnl": _round(pnl, 2),
                "avgPnl": _round(pnl / len(own), 4),
            } if own else None)
        rows.append({"rule": index, "cells": cells})
    return {"version": VERSION, "columns": columns, "rows": rows}


def exit_mix(paths: list[dict], entries: list[dict], columns: list[dict]) -> dict:
    """4.2 — Como sai cada entrada: a % dos trades de cada entrada por saída."""
    rows = []
    for index in range(1, len(entries) + 1):
        own = [p for p in paths if p["rule"] == index]
        shares = [
            _round(sum(1 for p in own if p["exitKey"] == column["key"]) / len(own) * 100, 2) if own else None
            for column in columns
        ]
        rows.append({"rule": index, "trades": len(own), "pct": shares})
    return {"version": VERSION, "columns": [column["key"] for column in columns], "rows": rows}

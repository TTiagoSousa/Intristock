"""4.6 — Capital por entrada: Kelly, esquemas de risco e a correlação."""

from __future__ import annotations

import numpy as np

from ...market.candles import Candles
from ..columns import VERSION
from ..common import DAY_MS, _mean, _payoff, _profit_factor, _round, _win_rate
from ..equity import _daily_equity, _daily_stats, _performance_index


# 4.6: o risco base, o teto dos esquemas e o teto da sugestão, em % do capital por trade
SCHEME_RISK = 1.0
SCHEME_MAX_RISK = 2.0
SUGGESTION_MAX_RISK = 1.5
SIZING_SCHEMES = ("equal", "positive", "proportional", "quarterKelly", "dropWorst", "doubleBest")


def entry_kelly(paths: list[dict], entries: list[dict], split_ms: int) -> dict:
    """4.6 — Kelly e tamanho sugerido, só com os trades dentro da amostra: win
    rate, payoff, Kelly (W − (1 − W) ÷ payoff), ¼ Kelly (nunca abaixo de 0, até
    `SCHEME_MAX_RISK`), o proporcional à expectancy em R (o da média das
    positivas = `SCHEME_RISK`) e a sugestão (até ¼ Kelly, no máximo
    `SUGGESTION_MAX_RISK`; nula = desligar ou rever)."""
    rows = []
    for index in range(1, len(entries) + 1):
        own = [p for p in paths if p["rule"] == index and p["trade"].entry_time < split_ms]
        trades = [p["trade"] for p in own]
        win = _win_rate(trades)
        payoff = _payoff(trades)
        if win is not None and payoff:
            kelly = (win / 100 - (1 - win / 100) / payoff) * 100
        elif win is not None and trades:
            kelly = 100.0 if win == 100 else -100.0  # só ganhos ou só perdas
        else:
            kelly = None
        rows.append({
            "rule": index,
            "trades": len(own),
            "winRatePct": _round(win, 2),
            "payoff": _round(payoff, 3),
            "expectancyR": _round(_mean(p["r"] for p in own), 4),
            "kellyPct": _round(kelly, 2),
            "quarterKellyPct": _round(min(max(kelly / 4, 0.0), SCHEME_MAX_RISK) if kelly is not None else None, 3),
        })
    positive = [row["expectancyR"] for row in rows if row["expectancyR"] is not None and row["expectancyR"] > 0]
    average = float(np.mean(positive)) if positive else None
    for row in rows:
        expectancy = row["expectancyR"]
        row["proportionalPct"] = _round(
            min(expectancy / average * SCHEME_RISK, SCHEME_MAX_RISK) if average and expectancy and expectancy > 0 else 0.0,
            3,
        )
        kelly = row["kellyPct"]
        row["suggestionPct"] = (
            _round(min(row["quarterKellyPct"], SUGGESTION_MAX_RISK), 3) if kelly is not None and kelly > 0 else None
        )
    return {"version": VERSION, "rows": rows}


def scheme_risks(kelly: dict) -> list[tuple[str, list[float]]]:
    """4.6 — O risco de cada entrada em cada esquema, escolhido só com a parte
    dentro da amostra (a `entryKelly`). A pior e a melhor são as da expectancy
    em R dentro; com uma entrada só, não há pior nem melhor."""
    rows = kelly["rows"]
    count = len(rows)
    ranked = [row for row in rows if row["expectancyR"] is not None]
    worst = min(ranked, key=lambda row: row["expectancyR"])["rule"] if len(ranked) > 1 else None
    best = max(ranked, key=lambda row: row["expectancyR"])["rule"] if len(ranked) > 1 else None
    schemes = [
        ("equal", [SCHEME_RISK] * count),
        ("positive", [SCHEME_RISK if (row["expectancyR"] or 0) > 0 else 0.0 for row in rows]),
        ("proportional", [row["proportionalPct"] for row in rows]),
        ("quarterKelly", [row["quarterKellyPct"] or 0.0 for row in rows]),
    ]
    if worst is not None:
        schemes.append(("dropWorst", [0.0 if row["rule"] == worst else SCHEME_RISK for row in rows]))
        schemes.append(("doubleBest", [
            SCHEME_MAX_RISK if row["rule"] == best else 0.0 if row["rule"] == worst else SCHEME_RISK for row in rows
        ]))
    return schemes


def scheme_stats(trades, initial, deposits, deposit_amounts, minutes: Candles, start_ms: int, end_ms: int,
                 split_ms: int) -> dict:
    """4.6 — Uma corrida de um esquema: a maior queda e o Calmar no índice de
    performance, e fora da amostra o retorno (o índice desde o dia da divisão)
    e o PF dos trades que entraram nessa parte."""
    marks, _, values, invested_at = _daily_equity(trades, initial, deposits, deposit_amounts, minutes, start_ms, end_ms)
    index = _performance_index(values, invested_at)
    days = (marks[-1] - marks[0]) / DAY_MS
    stats = _daily_stats(index, days)
    cut = max(int(np.searchsorted(marks, split_ms, side="right")) - 1, 0)
    outside = index[cut:]
    return {
        "maxDrawdownPct": stats["maxDrawdownPct"],
        "calmar": stats["calmar"],
        "outReturnPct": (float(outside[-1] / outside[0]) - 1) * 100 if len(outside) > 1 and outside[0] > 0 else None,
        "outProfitFactor": _profit_factor([t for t in trades if t.entry_time >= split_ms]),
    }


def entry_correlation(paths: list[dict], entries: list[dict], start_ms: int, end_ms: int) -> dict:
    """4.6 — Correlação entre entradas: o P&L de cada semana (segunda a domingo,
    UTC, pela saída) de cada entrada e a correlação de Pearson entre cada par
    (nula se uma das entradas não varia)."""
    week = 7 * DAY_MS
    # 1 jan 1970 foi quinta: as semanas começam 3 dias depois
    origin = 4 * DAY_MS
    first = (start_ms - origin) // week
    count = int((end_ms - origin) // week - first + 1)
    weekly = np.zeros((len(entries), max(count, 1)))
    for path in paths:
        position = int((path["trade"].exit_time - origin) // week - first)
        if 0 <= position < count and 0 < path["rule"] <= len(entries):
            weekly[path["rule"] - 1, position] += path["trade"].pnl
    matrix = []
    for a in range(len(entries)):
        row = []
        for b in range(len(entries)):
            x, y = weekly[a], weekly[b]
            if np.std(x) < 1e-12 or np.std(y) < 1e-12:
                row.append(None)
            else:
                row.append(_round(np.corrcoef(x, y)[0, 1], 4))
        matrix.append(row)
    return {"version": VERSION, "weeks": count, "rules": list(range(1, len(entries) + 1)), "matrix": matrix}

"""3.2 — Monte Carlo aos blocos sobre os retornos diários."""

from __future__ import annotations

import math

import numpy as np

from .. import factsheet as fs
from .common import _round


MC_PATHS = 1000
MC_BLOCK_DAYS = 10
MC_POINTS = 200
MC_SEED = 42
MC_BINS = 30
# As quedas da tabela da ruína, em %
MC_RUIN_LEVELS = [10, 20, 30, 50]


# 3.2 — Monte Carlo


def monte_carlo(marks: np.ndarray, index: np.ndarray) -> dict:
    """O índice sorteado aos blocos de dias: os cartões (o real e os percentis
    do retorno e da queda, a probabilidade de acabar a perder e em que
    percentil caiu o real), o leque (os percentis 5, 25, 50, 75 e 95 do
    retorno acumulado em `MC_POINTS` dias e o real) e o histograma da maior
    queda com a probabilidade de cair cada `MC_RUIN_LEVELS`."""
    head = {"version": fs.VERSION, "paths": MC_PATHS, "blockDays": MC_BLOCK_DAYS}
    with np.errstate(divide="ignore", invalid="ignore"):
        daily = np.where(index[:-1] > 0, index[1:] / index[:-1] - 1, 0.0)
    count = len(daily)
    if count < MC_BLOCK_DAYS * 2:
        empty = {**head, "available": False}
        return {"monteCarloCards": empty, "monteCarloFan": empty, "monteCarloDrawdowns": empty}

    rng = np.random.default_rng(MC_SEED)
    blocks = math.ceil(count / MC_BLOCK_DAYS)
    starts = rng.integers(0, count - MC_BLOCK_DAYS + 1, size=(MC_PATHS, blocks))
    picks = (starts[:, :, None] + np.arange(MC_BLOCK_DAYS)).reshape(MC_PATHS, -1)[:, :count]
    paths = np.concatenate((np.ones((MC_PATHS, 1)), np.cumprod(1 + daily[picks], axis=1)), axis=1)
    finals = (paths[:, -1] - 1) * 100
    peaks = np.maximum.accumulate(paths, axis=1)
    drops = ((1 - paths / peaks).max(axis=1)) * 100

    real_index = index / index[0]
    real_return = (float(real_index[-1]) - 1) * 100
    real_drop = fs._max_drawdown(index)

    points = np.unique(np.linspace(0, count, min(MC_POINTS, count + 1)).round().astype(int))
    bands = np.percentile(paths[:, points], [5, 25, 50, 75, 95], axis=0)
    fan = {
        **head,
        "available": True,
        "columns": ["time", "p5", "p25", "p50", "p75", "p95", "real"],
        "points": [
            [int(marks[i]), *[_round((float(b[j]) - 1) * 100, 3) for b in bands], _round((float(real_index[i]) - 1) * 100, 3)]
            for j, i in enumerate(points)
        ],
    }

    top = max(float(drops.max()), real_drop, 1.0)
    counts, edges = np.histogram(drops, bins=MC_BINS, range=(0, top))
    drawdowns = {
        **head,
        "available": True,
        "bins": [[_round(float(edges[i]), 3), _round(float(edges[i + 1]), 3), int(counts[i])] for i in range(MC_BINS)],
        "real": _round(real_drop, 3),
        "ruin": [{"level": level, "pct": _round(float((drops >= level).mean()) * 100, 2)} for level in MC_RUIN_LEVELS],
    }
    cards = {
        **head,
        "available": True,
        "realReturnPct": _round(real_return, 2),
        "returnP5": _round(float(np.percentile(finals, 5)), 2),
        "returnP50": _round(float(np.percentile(finals, 50)), 2),
        "returnP95": _round(float(np.percentile(finals, 95)), 2),
        "realDrawdownPct": _round(real_drop, 2),
        "drawdownP50": _round(float(np.percentile(drops, 50)), 2),
        "drawdownP95": _round(float(np.percentile(drops, 95)), 2),
        "lossPct": _round(float((finals < 0).mean()) * 100, 2),
        # Em que percentil dos caminhos ficou o real (100 = melhor que todos)
        "realReturnRank": _round(float((finals <= real_return).mean()) * 100, 1),
        "realDrawdownRank": _round(float((drops <= real_drop).mean()) * 100, 1),
    }
    return {"monteCarloCards": cards, "monteCarloFan": fan, "monteCarloDrawdowns": drawdowns}

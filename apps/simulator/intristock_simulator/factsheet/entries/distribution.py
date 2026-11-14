"""4.5 — Os trades em R, a MAE e a duração."""

from __future__ import annotations

import math

import numpy as np

from ..columns import VERSION
from ..common import _initial_stop, _mean, _round, _win_rate


# 4.5: as barras do histograma em R e até onde vai (o resto fica nas pontas)
R_BIN = 0.25
R_RANGE = (-3.0, 6.0)
# 4.5: os intervalos de duração, em velas (o último aberto)
DURATION_BUCKETS = ((1, 2), (3, 6), (7, 12), (13, 24), (25, 48), (49, 96), (97, 192), (193, None))


def r_distribution(paths: list[dict]) -> dict:
    """4.5 — Resultado por trade em R: barras de `R_BIN` R (de `R_RANGE`, o resto
    nas pontas). Os trades sem stop não têm R e ficam de fora (`withoutStop`)."""
    values = np.array([p["r"] for p in paths if p["r"] is not None], dtype=float)
    if not len(values):
        return {"version": VERSION, "binWidth": R_BIN, "bins": [], "trades": 0, "withoutStop": len(paths)}
    low = max(math.floor(values.min() / R_BIN) * R_BIN, R_RANGE[0])
    high = min(math.ceil(values.max() / R_BIN) * R_BIN, R_RANGE[1])
    if high <= low:
        high = low + R_BIN
    count = int(round((high - low) / R_BIN))
    clipped = np.clip(values, low, high - 1e-9)
    histogram = np.bincount(((clipped - low) // R_BIN).astype(int), minlength=count)[:count]
    return {
        "version": VERSION,
        "binWidth": R_BIN,
        "bins": [{"from": _round(low + i * R_BIN, 4), "to": _round(low + (i + 1) * R_BIN, 4), "count": int(n)}
                 for i, n in enumerate(histogram)],
        "trades": int(len(values)),
        "withoutStop": len(paths) - int(len(values)),
        "minR": _round(values.min(), 4),
        "maxR": _round(values.max(), 4),
    }


# 4.5: o eixo do resultado vai até ao percentil 98 (mais uma folga); os poucos acima ficam de fora do desenho
MAE_RESULT_PERCENTILE = 98
MAE_RESULT_HEADROOM = 1.2


def mae_scatter(paths: list[dict]) -> dict:
    """4.5 — MAE vs resultado: um ponto por trade, a excursão adversa máxima e
    o resultado (ambos em % do valor de entrada) e se ganhou. `resultMinPct` e
    `resultMaxPct` são os limites do eixo do resultado: o pior e o percentil 98
    com folga, para um trade enorme não esmagar os outros."""
    results = np.array([p["resultPct"] for p in paths], dtype=float)
    low = float(min(results.min(), 0.0)) * MAE_RESULT_HEADROOM if len(results) else -1.0
    high = float(np.percentile(results, MAE_RESULT_PERCENTILE)) * MAE_RESULT_HEADROOM if len(results) else 1.0
    return {
        "resultMinPct": _round(low, 4),
        "resultMaxPct": _round(max(high, 0.0) or 1.0, 4),
        "version": VERSION,
        "columns": ["maePct", "resultPct", "won"],
        "points": [[round(p["maePct"], 4) + 0.0, round(p["resultPct"], 4) + 0.0, int(p["trade"].pnl > 0)]
                   for p in paths],
        "minMaePct": _round(min((p["maePct"] for p in paths), default=0.0), 4),
    }


def duration_buckets(paths: list[dict]) -> dict:
    """4.5 — Duração × resultado: por intervalo de velas abertas
    (`DURATION_BUCKETS`, só os que têm trades): trades, win rate, expectancy,
    R médio, % de stops e P&L."""
    rows = []
    for low, high in DURATION_BUCKETS:
        own = [p for p in paths if p["bars"] >= low and (high is None or p["bars"] <= high)]
        if not own:
            continue
        trades = [p["trade"] for p in own]
        pnl = float(sum(t.pnl for t in trades))
        rows.append({
            "fromBars": low,
            "toBars": high,
            "trades": len(own),
            "winRatePct": _round(_win_rate(trades), 2),
            "expectancy": _round(pnl / len(own), 4),
            "avgR": _round(_mean(p["r"] for p in own), 4),
            "stopsPct": _round(sum(1 for t in trades if _initial_stop(t)) / len(own) * 100, 2),
            "pnl": _round(pnl, 2),
        })
    return {"version": VERSION, "rows": rows}

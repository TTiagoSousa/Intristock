"""3.3 — Walk-forward em janelas."""

from __future__ import annotations

import numpy as np

from .. import factsheet as fs
from .common import _drawdown, _growth, _round


WF_WINDOWS = 6


# 3.3 — Walk-forward


def walk_forward(marks: np.ndarray, prices: np.ndarray, index: np.ndarray, trades, candidates: list[tuple]) -> dict:
    """O período em `WF_WINDOWS` janelas de dias iguais. Em cada uma: a
    estratégia como está (retorno, queda e trades pela entrada), o comprar e
    manter e, a partir da segunda, a variante (`candidates`: chave e índice)
    que foi a melhor na janela anterior e o que fez nesta, e a melhor desta
    (a olhar para trás, só para comparar). A cadeia walk-forward junta as
    escolhidas; a fixa, a atual nas mesmas janelas."""
    head = {"version": fs.VERSION, "windows": WF_WINDOWS}
    if len(marks) < WF_WINDOWS * 10:
        empty = {**head, "available": False}
        return {"walkForwardCards": empty, "walkForward": empty}
    edges = np.linspace(0, len(marks) - 1, WF_WINDOWS + 1).round().astype(int)
    rows = []
    chosen_chain = fixed_chain = 1.0
    previous_best = None
    for w in range(WF_WINDOWS):
        a, b = int(edges[w]), int(edges[w + 1])
        current = _growth(index, a, b)
        own = [t for t in trades if marks[a] <= t.entry_time < marks[b]]
        results = [(key, _growth(series, a, b)) for key, series in candidates]
        results = [(key, value) for key, value in results if value is not None]
        best = max(results, key=lambda item: item[1], default=None)
        row = {
            "window": w + 1, "from": int(marks[a]), "to": int(marks[b]),
            "returnPct": _round(current, 2), "drawdownPct": _round(_drawdown(index[a:b + 1]), 2),
            "buyHoldPct": _round((float(prices[b] / prices[a]) - 1) * 100, 2) if prices[a] > 0 else None,
            "trades": len(own), "pnl": _round(sum(t.pnl for t in own), 2),
            "bestKey": best[0] if best else None, "bestReturnPct": _round(best[1], 2) if best else None,
            "chosenKey": None, "chosenReturnPct": None,
        }
        if w > 0 and previous_best is not None:
            chosen = dict(results).get(previous_best)
            row["chosenKey"], row["chosenReturnPct"] = previous_best, _round(chosen, 2)
            if chosen is not None:
                chosen_chain *= 1 + chosen / 100
            if current is not None:
                fixed_chain *= 1 + current / 100
        previous_best = best[0] if best else None
        rows.append(row)
    later = rows[1:]
    cards = {
        **head, "available": True,
        "positiveWindows": sum(1 for r in rows if (r["returnPct"] or 0) > 0),
        "beatBuyHold": sum(1 for r in rows if r["returnPct"] is not None and r["buyHoldPct"] is not None
                           and r["returnPct"] > r["buyHoldPct"]),
        "walkForwardPct": _round((chosen_chain - 1) * 100, 2),
        "fixedPct": _round((fixed_chain - 1) * 100, 2),
        "chosenPositive": sum(1 for r in later if (r["chosenReturnPct"] or 0) > 0),
        "worstWindowPct": _round(min((r["returnPct"] for r in rows if r["returnPct"] is not None), default=None), 2),
        # Reotimizar ajuda? As janelas em que a variante escolhida fez melhor do que a estratégia como está
        "chosenBeatFixed": sum(1 for r in later if r["chosenReturnPct"] is not None and r["returnPct"] is not None
                               and r["chosenReturnPct"] > r["returnPct"]),
    }
    return {"walkForwardCards": cards, "walkForward": {**head, "available": True, "rows": rows}}

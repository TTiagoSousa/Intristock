"""1.2 — Equity e drawdown, equity no ativo e underwater."""

from __future__ import annotations

import numpy as np

from ...market.candles import Candles
from ..columns import VERSION
from ..common import DAY_MS
from ..equity import _buy_hold_values


def equity_curve(marks, prices, values, index, final: float, initial: float, deposits, deposit_amounts,
                 minutes: Candles, fee_entry: float) -> dict:
    """1.2 — Equity e drawdown: um ponto por dia (e o início) com o capital da
    estratégia e o de comprar e manter, na moeda cotada (com os depósitos), e o
    drawdown da estratégia em % (a distância ao máximo do índice de performance,
    sem depósitos: 0 ou negativo)."""
    hold = _buy_hold_values(marks, prices, initial, deposits, deposit_amounts, minutes, fee_entry)
    peaks = np.maximum.accumulate(index)
    with np.errstate(divide="ignore", invalid="ignore"):
        drawdown = np.where(peaks > 0, (index / peaks - 1) * 100, 0.0)
    return {
        "version": VERSION,
        "columns": ["time", "equity", "buyHold", "drawdownPct"],
        "points": [
            [int(t), round(float(e), 2), round(float(b), 2), round(float(d), 3) + 0.0]
            for t, e, b, d in zip(marks, values, hold, drawdown)
        ],
        "finalEquity": round(float(final), 2),
        "finalBuyHold": round(float(hold[-1]), 2),
        "maxDrawdownPct": round(float(-drawdown.min()), 3) + 0.0,
    }


def equity_in_base(marks, prices, values, final: float, minutes: Candles) -> dict:
    """1.2 — Equity no ativo: o capital de cada dia dividido pelo preço nesse
    momento (o último ao fecho do período). A quantidade inicial é a do início."""
    closes = prices.astype(float).copy()
    closes[-1] = float(minutes.close[-1])
    with np.errstate(divide="ignore", invalid="ignore"):
        base = np.where(closes > 0, values / closes, 0.0)
    base[-1] = final / closes[-1] if closes[-1] > 0 else 0.0
    return {
        "version": VERSION,
        "columns": ["time", "equity"],
        "points": [[int(t), round(float(b), 8)] for t, b in zip(marks, base)],
        "initialQuantity": round(float(base[0]), 8),
        "finalQuantity": round(float(base[-1]), 8),
    }


def underwater(marks, index: np.ndarray) -> dict:
    """1.2 — Underwater: a distância de cada dia ao máximo anterior do índice de
    performance (sem depósitos), em % (0 ou negativa); a maior queda e o período
    mais longo abaixo do máximo, em dias (do máximo até voltar a ele, ou ao fim)."""
    peaks = np.maximum.accumulate(index)
    with np.errstate(divide="ignore", invalid="ignore"):
        drawdown = np.where(peaks > 0, (index / peaks - 1) * 100, 0.0)
    # Do máximo até ao dia em que volta a ele (ou até ao fim), como nos episódios
    longest = 0
    peak_at = int(marks[0])
    for t, d in zip(marks, drawdown):
        if d >= 0:
            longest = max(longest, int(t) - peak_at)
            peak_at = int(t)
    longest = max(longest, int(marks[-1]) - peak_at) if drawdown[-1] < 0 else longest
    return {
        "version": VERSION,
        "columns": ["time", "drawdownPct"],
        "points": [[int(t), round(float(d), 3) + 0.0] for t, d in zip(marks, drawdown)],
        "maxDrawdownPct": round(float(-drawdown.min()), 3) + 0.0,
        "longestDays": round(longest / DAY_MS),
    }

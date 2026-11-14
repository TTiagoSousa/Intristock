"""O índice de performance diário e as contas que os testes partilham."""

from __future__ import annotations

import numpy as np

from .. import factsheet as fs
from ..market.candles import Candles


def _round(value, digits: int = 4):
    return fs._round(value, digits)


def daily_index(trades, initial, deposits, deposit_amounts, minutes: Candles, start_ms: int, end_ms: int):
    """As marcas diárias (UTC), o preço em cada uma e o índice de performance
    (sem depósitos), como no Resumo."""
    marks, prices, values, invested = fs._daily_equity(trades, initial, deposits, deposit_amounts, minutes, start_ms, end_ms)
    return marks, prices, fs._performance_index(values, invested)


def _growth(index: np.ndarray, a: int, b: int) -> float | None:
    if b <= a or index[a] <= 0:
        return None
    return (float(index[b] / index[a]) - 1) * 100


def _drawdown(segment: np.ndarray) -> float:
    return -fs._max_drawdown(segment) if len(segment) else 0.0


def performance_curve(marks: np.ndarray, index: np.ndarray) -> dict:
    """Para comparar simulações: o retorno acumulado (%) do índice em cada dia."""
    return {"version": fs.VERSION, "columns": ["time", "returnPct"],
            "points": [[int(t), _round((float(v / index[0]) - 1) * 100, 3)] for t, v in zip(marks, index)]}

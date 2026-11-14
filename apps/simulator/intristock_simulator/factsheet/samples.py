"""3.1 — Dentro e fora da amostra: a divisão do período e cada parte."""

from __future__ import annotations

import numpy as np

from ..market.candles import Candles
from .columns import VERSION
from .common import DAY_MS, _profit_factor, _round
from .equity import _cagr, _daily_equity, _max_drawdown, _sharpe


# Sem `outOfSamplePct` na simulação, fora da amostra são os últimos 30% do período
DEFAULT_OUT_OF_SAMPLE_PCT = 30.0

# As linhas da 3.1, por esta ordem
SAMPLE_METRICS = (
    "trades", "winRatePct", "profit", "annualReturnPct", "profitFactor", "maxDrawdownPct", "sharpe", "buyHoldPct",
    "expectancyR",
)


def _sample_part(trades, index: np.ndarray, marks: np.ndarray, prices: np.ndarray, entries: list[dict]) -> dict:
    """As métricas de uma parte: os trades que entraram nela e o índice de
    performance e o preço nos dias dela. A maior queda vai negativa, para a
    degradação se ler como nas outras (subir é melhorar)."""
    days = (marks[-1] - marks[0]) / DAY_MS if len(marks) > 1 else 0
    daily = index[1:] / index[:-1] - 1 if len(index) > 1 else np.array([])
    multiples = []
    for trade in trades:
        # O risco de cada trade: a distância ao stop que teve ao entrar
        stop_pct = (trade.stop_pct or 0) / 100
        if stop_pct and trade.quantity * trade.entry_price > 0:
            multiples.append(trade.pnl / (trade.quantity * trade.entry_price * stop_pct))
    return {
        "trades": len(trades),
        "winRatePct": sum(1 for t in trades if t.pnl > 0) / len(trades) * 100 if trades else None,
        "profit": float(sum(t.pnl for t in trades)),
        "annualReturnPct": _cagr(index, days) if len(index) > 1 else None,
        "profitFactor": _profit_factor(trades),
        "maxDrawdownPct": -_max_drawdown(index),
        "sharpe": _sharpe(daily),
        "buyHoldPct": (float(prices[-1] / prices[0]) - 1) * 100 if len(prices) > 1 and prices[0] > 0 else None,
        "expectancyR": float(np.mean(multiples)) if multiples else None,
    }


def _split_at(marks: np.ndarray, out_of_sample_pct):
    """Onde o período se divide: no `outOfSamplePct` (sem ele, nos últimos 30%,
    como a nota), arredondado ao início do dia (a marca em `marks`) para os trades
    e o índice se dividirem no mesmo instante em todos os blocos. Dá se foi
    definido, a %, o instante e o dia (índice em `marks`)."""
    configured = bool(out_of_sample_pct and 0 < out_of_sample_pct < 100)
    split_pct = out_of_sample_pct if configured else DEFAULT_OUT_OF_SAMPLE_PCT
    target = int(marks[0] + (marks[-1] - marks[0]) * (1 - split_pct / 100))
    cut = max(int(np.searchsorted(marks, target, side="right")) - 1, 0)
    return configured, split_pct, int(marks[cut]), cut


def sample_equity(marks: np.ndarray, values: np.ndarray, out_of_sample_pct) -> dict:
    """3.1 — Equity com a divisão: o capital de cada dia (como na 1.2, com os
    depósitos) e o dia da divisão da `sampleSplit`, onde fica a linha tracejada."""
    configured, split_pct, _, cut = _split_at(marks, out_of_sample_pct)
    return {
        "version": VERSION,
        "columns": ["time", "equity"],
        "points": [[int(t), round(float(e), 2)] for t, e in zip(marks, values)],
        "outOfSamplePct": split_pct,
        "configured": configured,
        "splitTime": int(marks[cut]),
    }


def sample_split(trades, index: np.ndarray, marks: np.ndarray, prices: np.ndarray, last_close: float,
                 entries: list[dict], out_of_sample_pct) -> dict:
    """3.1 — Dentro vs fora da amostra: o período dividido no `outOfSamplePct`
    (sem ele, nos últimos 30%, como a nota), com os trades pela entrada e o
    índice e o preço de cada lado do dia da divisão. A degradação é
    (fora − dentro) ÷ |dentro| em %: negativa = pior fora."""
    configured, split_pct, split, cut = _split_at(marks, out_of_sample_pct)
    closes = prices.astype(float).copy()
    closes[-1] = last_close
    inside = _sample_part(
        [t for t in trades if t.entry_time < split], index[: cut + 1], marks[: cut + 1], closes[: cut + 1], entries
    )
    outside = _sample_part(
        [t for t in trades if t.entry_time >= split], index[cut:], marks[cut:], closes[cut:], entries
    )
    rows = []
    for key in SAMPLE_METRICS:
        a, b = inside[key], outside[key]
        degradation = (b - a) / abs(a) * 100 if a is not None and b is not None and abs(a) > 1e-12 else None
        rows.append({"key": key, "inside": _round(a, 4), "outside": _round(b, 4), "degradationPct": _round(degradation, 2)})
    return {
        "version": VERSION,
        "outOfSamplePct": split_pct,
        "configured": configured,
        "splitTime": int(marks[cut]),
        "rows": rows,
    }


def split_time(trades, initial, deposits, deposit_amounts, minutes: Candles, start_ms: int, end_ms: int,
               out_of_sample_pct) -> int:
    """O instante em que o período se divide, como na 3.1."""
    marks, _, _, _ = _daily_equity(trades, initial, deposits, deposit_amounts, minutes, start_ms, end_ms)
    return _split_at(marks, out_of_sample_pct)[2]

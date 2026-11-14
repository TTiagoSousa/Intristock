"""A equity dia a dia e o índice de performance (sem depósitos), com o drawdown, o CAGR,
o Sharpe e o comprar e manter."""

from __future__ import annotations

import math

import numpy as np

from ..market.candles import Candles
from .common import DAY_MS, SHARPE_YEAR_DAYS, YEAR_DAYS


def _time_in_market(trades, start_ms: int, end_ms: int) -> float:
    """% do período com pelo menos uma posição aberta (os trades juntos, sem
    contar duas vezes o tempo em que há duas)."""
    span = end_ms - start_ms
    if span <= 0:
        return 0.0
    covered, reach = 0, start_ms
    for begin, end in sorted((max(t.entry_time, start_ms), min(t.exit_time, end_ms)) for t in trades):
        begin = max(begin, reach)
        if end > begin:
            covered += end - begin
            reach = end
    return covered / span * 100


def _daily_equity(trades, initial: float, deposits, deposit_amounts, minutes: Candles, start_ms: int, end_ms: int):
    """O capital no fim de cada dia UTC, com as posições abertas ao preço desse
    momento (sem as comissões de saída, que ainda não se pagaram), mais o início.
    Devolve as marcas (ms), o preço em cada uma, o capital e o que já se tinha
    metido (capital inicial + depósitos). O último ponto é o fim do período."""
    first_day = start_ms - start_ms % DAY_MS
    marks = np.arange(first_day + DAY_MS, end_ms, DAY_MS, dtype=np.int64)
    marks = np.concatenate(([start_ms], marks, [end_ms]))
    prices, equity, invested = _equity_at(trades, initial, deposits, deposit_amounts, minutes, marks)
    return marks, prices, equity, invested


def _equity_at(trades, initial: float, deposits, deposit_amounts, minutes: Candles, marks: np.ndarray):
    """O capital em cada marca (ms, por ordem), como em `_daily_equity`: o preço
    em cada uma, o capital e o que já se tinha metido."""
    # O preço em cada marca: a abertura do minuto que começa nela (o fecho do dia)
    at = np.clip(np.searchsorted(minutes.time, marks, side="left"), 0, len(minutes) - 1)
    prices = minutes.open[at].astype(float)

    # O que já entrou em depósitos e o lucro dos trades já fechados em cada marca
    if len(deposits):
        paid = np.searchsorted(deposits, marks, side="right")
        added = np.concatenate(([0.0], np.cumsum(deposit_amounts, dtype=float)))[paid]
    else:
        added = np.zeros(len(marks))
    exits = np.array([t.exit_time for t in trades], dtype=np.int64)
    order = np.argsort(exits, kind="stable")
    closed = np.searchsorted(exits[order], marks, side="right")
    pnl = np.concatenate(([0.0], np.cumsum(np.array([trades[i].pnl for i in order], dtype=float))))[closed]
    equity = initial + added + pnl

    # E as posições abertas em cada marca (entrou antes e ainda não saiu)
    for t in trades:
        lo = int(np.searchsorted(marks, t.entry_time, side="right"))
        hi = int(np.searchsorted(marks, t.exit_time, side="left"))
        if hi > lo:
            direction = 1 if t.side == "long" else -1
            equity[lo:hi] += direction * t.quantity * (prices[lo:hi] - t.entry_price)
            # Os reforços contam desde que entraram, ao preço deles
            for add in t.adds or []:
                start = max(lo, int(np.searchsorted(marks, add["time"], side="right")))
                if hi > start:
                    equity[start:hi] += direction * add["quantity"] * (prices[start:hi] - add["price"])
    return prices, equity, initial + added


def _performance_index(values: np.ndarray, invested: np.ndarray) -> np.ndarray:
    """O índice de performance (começa em 1): cada dia multiplica pelo retorno
    desse dia sem o depósito que entrou, (capital − depósito) ÷ capital da véspera."""
    index = np.ones(len(values))
    for i in range(1, len(values)):
        deposit = invested[i] - invested[i - 1]
        ratio = (values[i] - deposit) / values[i - 1] if values[i - 1] > 0 else 1.0
        index[i] = index[i - 1] * ratio
    return index


def _max_drawdown(index: np.ndarray) -> float:
    """A maior queda, em %, de um pico ao fundo seguinte."""
    if not len(index):
        return 0.0
    peaks = np.maximum.accumulate(index)
    with np.errstate(divide="ignore", invalid="ignore"):
        falls = np.where(peaks > 0, (peaks - index) / peaks, 0.0)
    return float(np.max(falls) * 100)


def _cagr(index: np.ndarray, days: float) -> float | None:
    years = days / YEAR_DAYS
    if years <= 0 or index[0] <= 0 or index[-1] <= 0:
        return None
    return (float(index[-1] / index[0]) ** (1 / years) - 1) * 100


def _sharpe(daily: np.ndarray) -> float | None:
    """Média ÷ desvio dos retornos diários, × √365, sem taxa sem risco."""
    if len(daily) < 2:
        return None
    std = float(np.std(daily, ddof=1))
    return float(np.mean(daily)) / std * math.sqrt(SHARPE_YEAR_DAYS) if std > 1e-12 else None


def _daily_stats(index: np.ndarray, days: float) -> dict:
    """Sharpe, Sortino (só o desvio dos dias a perder), volatilidade anualizada,
    a maior queda, o CAGR e o Calmar (CAGR ÷ maior queda) de um índice."""
    daily = index[1:] / index[:-1] - 1 if len(index) > 1 else np.array([])
    downside = float(np.sqrt(np.mean(np.minimum(daily, 0) ** 2))) if len(daily) else 0.0
    cagr = _cagr(index, days)
    drawdown = _max_drawdown(index)
    return {
        "sharpe": _sharpe(daily),
        "sortino": float(np.mean(daily)) / downside * math.sqrt(SHARPE_YEAR_DAYS) if downside > 1e-12 else None,
        "volatilityPct": float(np.std(daily, ddof=1)) * math.sqrt(SHARPE_YEAR_DAYS) * 100 if len(daily) > 1 else None,
        "maxDrawdownPct": drawdown,
        "cagrPct": cagr,
        "calmar": cagr / drawdown if cagr is not None and drawdown > 0 else None,
    }


def _buy_hold(initial: float, deposits, deposit_amounts, minutes: Candles, start_ms: int, fee_entry: float) -> float:
    """Comprar e manter: compra com o capital inicial na abertura do período e com
    cada depósito quando entra, pagando a comissão de entrada; o resultado em %
    sobre o que se meteu."""
    first = int(np.clip(np.searchsorted(minutes.time, start_ms, side="left"), 0, len(minutes) - 1))
    units = initial * (1 - fee_entry) / float(minutes.open[first])
    invested = initial
    if len(deposits):
        at = np.clip(np.searchsorted(minutes.time, deposits, side="left"), 0, len(minutes) - 1)
        units += float(np.sum(np.asarray(deposit_amounts, dtype=float) * (1 - fee_entry) / minutes.open[at]))
        invested += float(np.sum(deposit_amounts))
    last = float(minutes.close[-1])
    return (units * last / invested - 1) * 100 if invested > 0 else 0.0


def _buy_hold_values(marks, prices, initial: float, deposits, deposit_amounts, minutes: Candles, fee_entry: float):
    """Comprar e manter dia a dia: as unidades compradas com o capital inicial no
    início e com cada depósito quando entra (com a comissão de entrada), ao preço
    de cada marca; a última ao fecho do período, como no cartão."""
    units = np.full(len(marks), initial * (1 - fee_entry) / float(prices[0]))
    if len(deposits):
        at = np.clip(np.searchsorted(minutes.time, deposits, side="left"), 0, len(minutes) - 1)
        bought = np.asarray(deposit_amounts, dtype=float) * (1 - fee_entry) / minutes.open[at]
        paid = np.searchsorted(deposits, marks, side="right")
        units = units + np.concatenate(([0.0], np.cumsum(bought)))[paid]
    values = units * prices
    values[-1] = units[-1] * float(minutes.close[-1])
    return values


def max_drawdown(trades, initial, deposits, deposit_amounts, minutes, start_ms, end_ms) -> float:
    """A maior queda do índice de performance, como no Resumo (para as variantes,
    que não fazem o relatório)."""
    _, _, values, invested_at = _daily_equity(trades, initial, deposits, deposit_amounts, minutes, start_ms, end_ms)
    return _max_drawdown(_performance_index(values, invested_at))

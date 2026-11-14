"""1.1 — Os 12 cartões do Resumo e a nota da estratégia (0 a 100)."""

from __future__ import annotations

import math

import numpy as np

from ...market.candles import Candles
from ..columns import VERSION
from ..common import DAY_MS, MONTH_DAYS, _costs, _profit_factor, _round
from ..equity import _buy_hold, _daily_stats, _time_in_market
from ..samples import _split_at


def summary(
    trades,
    initial: float,
    final: float,
    deposits,
    deposit_amounts,
    minutes: Candles,
    start_ms: int,
    end_ms: int,
    max_positions: int,
    fee_entry: float,
    index: np.ndarray,
) -> dict:
    """1.1 — Resumo: os 12 números que um investidor lê em dez segundos, num
    bloco só. `index` é o índice de performance diário (sem depósitos)."""
    deposited = float(np.sum(deposit_amounts)) if len(deposits) else 0.0
    invested = initial + deposited
    days = max((end_ms - start_ms) / DAY_MS, 0.0)
    stats = _daily_stats(index, days)

    net = final - invested
    wins = [t.pnl for t in trades if t.pnl > 0]
    losses = [t.pnl for t in trades if t.pnl <= 0]
    avg_win = sum(wins) / len(wins) if wins else None
    avg_loss = -sum(losses) / len(losses) if losses else None
    costs = _costs(trades)
    pnl = sum(t.pnl for t in trades)

    # Um dia é positivo quando o índice (sem depósitos) subiu
    daily = index[1:] / index[:-1] - 1
    positive_days = int(np.sum(daily > 1e-12))

    numbers = {
        "initialCapital": initial,
        "deposits": deposited,
        "finalCapital": final,
        "netProfit": net,
        "netProfitPct": net / invested * 100 if invested > 0 else None,
        "cagrPct": stats["cagrPct"],
        "buyHoldPct": _buy_hold(initial, deposits, deposit_amounts, minutes, start_ms, fee_entry),
        "sharpe": stats["sharpe"],
        "sortino": stats["sortino"],
        "maxDrawdownPct": stats["maxDrawdownPct"],
        "calmar": stats["calmar"],
        "volatilityPct": stats["volatilityPct"],
        "trades": len(trades),
        "tradesPerMonth": len(trades) / (days / MONTH_DAYS) if days > 0 else None,
        "winRatePct": len(wins) / len(trades) * 100 if trades else None,
        "payoff": avg_win / avg_loss if avg_win is not None and avg_loss else None,
        "profitFactor": _profit_factor(trades),
        "expectancy": pnl / len(trades) if trades else None,
        **costs,
        "timeInMarketPct": _time_in_market(trades, start_ms, end_ms),
        "maxOpenPositions": max_positions,
        "positiveDaysPct": positive_days / len(daily) * 100 if len(daily) else None,
        "positiveDays": positive_days,
        "days": len(daily),
        "fromTime": start_ms,
        "toTime": end_ms,
    }
    return {
        "version": VERSION,
        **{key: _round(value) if isinstance(value, float) else value for key, value in numbers.items()},
    }


# A nota da estratégia (1.1): cada parte é uma fração de 0 a 1 vezes o seu peso e
# a soma dá a nota. As escalas e os pesos são convenções (mais exigentes para
# cripto alavancada do que para ações)
SCORE_WEIGHTS = {"profitability": 25, "risk": 20, "outOfSample": 20, "significance": 15, "stability": 10, "costs": 10}
SCORE_SCALES = {
    "sharpeFull": 2.0,  # rentabilidade: Sharpe que vale a parte toda
    "cagrFullPct": 40.0,  # rentabilidade: CAGR que vale a parte toda
    "drawdownZeroPct": 30.0,  # risco: queda que vale 0
    "volatilityZeroPct": 60.0,  # risco: volatilidade que vale 0
    "tradesFull": 150,  # significância: trades a partir dos quais a amostra chega
    "costsZeroPct": 60.0,  # custos: % do lucro bruto que vale 0
}
# Os rótulos (a partir de) e a cor de cada parte (a partir de que fração)
SCORE_LABELS = [(70, "solid"), (45, "promising"), (0, "notReady")]


def _unit(value: float) -> float:
    return max(0.0, min(1.0, value))


def _psr(daily: np.ndarray) -> float | None:
    """Probabilistic Sharpe Ratio (Bailey e López de Prado): a probabilidade de o
    Sharpe real ser maior que 0, dado o Sharpe medido, o número de dias, a
    assimetria e a curtose dos retornos diários."""
    n = len(daily)
    if n < 3:
        return None
    std = float(np.std(daily, ddof=1))
    if std <= 1e-12:
        return None
    sr = float(np.mean(daily)) / std
    centered = daily - daily.mean()
    m2 = float(np.mean(centered**2))
    skew = float(np.mean(centered**3)) / m2**1.5 if m2 > 0 else 0.0
    kurtosis = float(np.mean(centered**4)) / m2**2 if m2 > 0 else 3.0
    spread = 1 - skew * sr + (kurtosis - 1) / 4 * sr**2
    if spread <= 0:
        return None
    return 0.5 * (1 + math.erf(sr * math.sqrt(n - 1) / math.sqrt(spread) / math.sqrt(2)))


def _r2_log(index: np.ndarray, marks: np.ndarray) -> float | None:
    """O R² de uma reta ajustada ao logaritmo do índice contra o tempo."""
    if len(index) < 3 or np.any(index <= 0):
        return None
    x = (marks - marks[0]) / DAY_MS
    y = np.log(index)
    slope, intercept = np.polyfit(x, y, 1)
    total = float(np.sum((y - y.mean()) ** 2))
    return 1 - float(np.sum((y - (slope * x + intercept)) ** 2)) / total if total > 0 else None


def strategy_score(trades, numbers: dict, index: np.ndarray, marks: np.ndarray, out_of_sample_pct) -> dict:
    """1.1 — Nota da estratégia, de 0 a 100: rentabilidade, risco, robustez fora
    da amostra, significância, estabilidade e custos. Cada parte guarda os números
    com que foi feita (para o "Como se calcula a nota")."""
    s = SCORE_SCALES
    sharpe, cagr = numbers["sharpe"], numbers["cagrPct"]
    drawdown, volatility = numbers["maxDrawdownPct"], numbers["volatilityPct"]

    profitability = 0.6 * _unit((sharpe or 0) / s["sharpeFull"]) + 0.4 * _unit((cagr or 0) / s["cagrFullPct"])
    risk = 0.7 * _unit(1 - drawdown / s["drawdownZeroPct"]) + 0.3 * _unit(1 - (volatility or 0) / s["volatilityZeroPct"])

    # Fora da amostra: os trades que entram depois da divisão e o índice desde lá
    _, split_pct, split, cut = _split_at(marks, out_of_sample_pct)
    out_return = (float(index[-1] / index[cut]) - 1) * 100 if 0 <= cut < len(index) and index[cut] > 0 else None
    inside = [t for t in trades if t.entry_time < split]
    outside = [t for t in trades if t.entry_time >= split]
    pf_in, pf_out = _profit_factor(inside), _profit_factor(outside)
    if pf_in and pf_out is not None:
        pf_ratio = _unit(pf_out / pf_in)
    elif outside and pf_out is None and any(t.pnl > 0 for t in outside):
        # Fora da amostra sem nenhuma perda: o melhor possível
        pf_ratio = 1.0
    else:
        pf_ratio = 0.0
    out_of_sample = (0.5 if out_return is not None and out_return > 0 else 0.0) + 0.5 * pf_ratio

    daily = index[1:] / index[:-1] - 1
    psr = _psr(daily)
    significance = _unit(len(trades) / s["tradesFull"]) * (psr or 0.0)

    r2 = _r2_log(index, marks)
    stability = _unit(r2 or 0.0)

    # Custos sobre o lucro bruto (o resultado dos trades antes dos custos)
    costs = numbers["costs"]
    gross = sum(t.pnl for t in trades) + costs
    costs_share = costs / gross * 100 if gross > 0 else None
    costs_part = _unit(1 - costs_share / s["costsZeroPct"]) if costs_share is not None else 0.0

    fractions = {
        "profitability": (profitability, {"sharpe": sharpe, "cagrPct": cagr}),
        "risk": (risk, {"maxDrawdownPct": drawdown, "volatilityPct": volatility}),
        "outOfSample": (
            out_of_sample,
            {
                "outOfSamplePct": split_pct,
                "returnPct": out_return,
                "profitFactorIn": pf_in,
                "profitFactorOut": pf_out,
                "tradesIn": len(inside),
                "tradesOut": len(outside),
            },
        ),
        "significance": (significance, {"trades": len(trades), "psr": psr}),
        "stability": (stability, {"r2": r2}),
        "costs": (costs_part, {"costs": costs, "grossProfit": gross, "costsPct": costs_share}),
    }
    parts = [
        {
            "key": key,
            "weight": weight,
            "fraction": _round(fractions[key][0]),
            "points": _round(fractions[key][0] * weight, 2),
            **{name: _round(value) if isinstance(value, float) else value for name, value in fractions[key][1].items()},
        }
        for key, weight in SCORE_WEIGHTS.items()
    ]
    value = sum(fractions[key][0] * weight for key, weight in SCORE_WEIGHTS.items())
    return {
        "version": VERSION,
        "value": round(value, 1),
        "label": next(name for floor, name in SCORE_LABELS if value >= floor),
        "parts": parts,
        "scales": SCORE_SCALES,
    }

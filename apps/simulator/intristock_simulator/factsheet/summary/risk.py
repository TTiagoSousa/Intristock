"""1.4 a 1.6 — Risco, rácios e a estratégia face ao ativo."""

from __future__ import annotations

import math

import numpy as np

from ...market.candles import Candles
from ..columns import VERSION
from ..common import DAY_MS, SHARPE_YEAR_DAYS, _round
from ..equity import _daily_stats


def risk_metrics(index: np.ndarray) -> dict:
    """1.4 — Riscos: os 10 cartões, nos retornos diários do índice de performance
    (sem depósitos), em %. VaR 95/99 = o percentil 5/1 (o dia que só 1 em 20/100 é
    pior), CVaR 95 = a média dos dias até ao VaR 95; skewness e kurtosis (excesso)
    dos retornos; Ulcer = raiz da média dos drawdowns ao quadrado, Pain = a média
    deles; tail ratio = P95 / |P5|; o pior e o melhor dia; e os episódios abaixo do
    pico (de um máximo até voltar a ele, ou ao fim)."""
    with np.errstate(divide="ignore", invalid="ignore"):
        daily = np.where(index[:-1] > 0, index[1:] / index[:-1] - 1, 0.0) * 100
    peaks = np.maximum.accumulate(index)
    with np.errstate(divide="ignore", invalid="ignore"):
        drawdown = np.where(peaks > 0, (index / peaks - 1) * 100, 0.0)
    below = drawdown < -1e-9
    episodes = int(np.sum(below[1:] & ~below[:-1]) + (1 if below[0] else 0))

    n = len(daily)
    if n < 2:
        empty = None
        return {"version": VERSION, "days": n, "var95Pct": empty, "cvar95Pct": empty, "var99Pct": empty,
                "skewness": empty, "kurtosis": empty, "ulcerIndexPct": empty, "painIndexPct": empty,
                "tailRatio": empty, "worstDayPct": empty, "bestDayPct": empty, "drawdowns": episodes}
    var95 = float(np.percentile(daily, 5))
    var99 = float(np.percentile(daily, 1))
    p95 = float(np.percentile(daily, 95))
    mean = float(daily.mean())
    centred = daily - mean
    m2 = float(np.mean(centred ** 2))
    skew = float(np.mean(centred ** 3)) / m2 ** 1.5 if m2 > 0 else None
    kurt = float(np.mean(centred ** 4)) / m2 ** 2 - 3 if m2 > 0 else None
    return {
        "version": VERSION,
        "days": n,
        "var95Pct": _round(var95),
        "cvar95Pct": _round(float(daily[daily <= var95].mean())),
        "var99Pct": _round(var99),
        "skewness": _round(skew),
        "kurtosis": _round(kurt),
        "ulcerIndexPct": _round(math.sqrt(float(np.mean(drawdown ** 2)))),
        "painIndexPct": _round(float(np.mean(-drawdown))),
        "tailRatio": _round(p95 / abs(var95)) if var95 < 0 else None,
        "worstDayPct": _round(float(daily.min())),
        "bestDayPct": _round(float(daily.max())),
        "drawdowns": episodes,
    }


def drawdown_episodes(marks, index: np.ndarray) -> dict:
    """1.4 — Os drawdowns: cada vez que o índice de performance (sem depósitos)
    cai abaixo do máximo anterior, o início (o dia do máximo), o fundo, a
    recuperação (o dia em que volta ao máximo; nulo se ainda não voltou), a
    profundidade em % e os dias até ao fundo, de recuperação e no total (até ao
    fim, se está em curso). Todos, do mais fundo para o menos fundo."""
    episodes = []
    peak_i = 0
    trough_i = None
    for i in range(1, len(index)):
        if index[i] >= index[peak_i]:
            if trough_i is not None:
                episodes.append((peak_i, trough_i, i))
                trough_i = None
            peak_i = i
        elif trough_i is None or index[i] < index[trough_i]:
            trough_i = i
    if trough_i is not None:
        episodes.append((peak_i, trough_i, None))

    def days(a: int, b: int) -> int:
        return round((int(marks[b]) - int(marks[a])) / DAY_MS)

    rows = []
    for start, trough, recovered in episodes:
        depth = (float(index[trough]) / float(index[start]) - 1) * 100 if index[start] > 0 else 0.0
        rows.append({
            "startTime": int(marks[start]),
            "troughTime": int(marks[trough]),
            "recoveryTime": None if recovered is None else int(marks[recovered]),
            "depthPct": _round(depth, 3),
            "daysToTrough": days(start, trough),
            "recoveryDays": None if recovered is None else days(trough, recovered),
            "totalDays": days(start, len(marks) - 1 if recovered is None else recovered),
        })
    rows.sort(key=lambda row: row["depthPct"])
    return {"version": VERSION, "episodes": rows}


# A leitura de cada rácio: o valor a partir do qual é "bom", "muito bom" e, no SQN,
# "excelente" (abaixo de bom, "fraco"). O Kelly só diz se há edge (> 0)
RATIO_LEVELS = {
    "sharpe": {"good": 1, "veryGood": 2},
    "sortino": {"good": 1.5, "veryGood": 3},
    "calmar": {"good": 0.8, "veryGood": 1.5},
    "omega": {"good": 1.15, "veryGood": 1.5},
    "gainToPain": {"good": 1, "veryGood": 2},
    "profitFactor": {"good": 1.3, "veryGood": 1.6},
    "sqn": {"good": 2, "excellent": 3},
    "kelly": {"good": 0},
}
# O SQN conta no máximo 100 trades (Van Tharp): com mais, o √n inflacionava-o
SQN_MAX_TRADES = 100


def _rating(key: str, value) -> str | None:
    if value is None:
        return None
    levels = RATIO_LEVELS[key]
    if key == "kelly":
        return "good" if value > levels["good"] else "noEdge"
    if "excellent" in levels and value >= levels["excellent"]:
        return "excellent"
    if "veryGood" in levels and value >= levels["veryGood"]:
        return "veryGood"
    return "good" if value >= levels["good"] else "weak"


def risk_ratios(trades, numbers: dict, index: np.ndarray, prices, minutes: Candles, months: list,
                start_ms: int, end_ms: int) -> dict:
    """1.5 — Rácios ajustados ao risco: Sharpe, Sortino e Calmar da estratégia (os
    dos cartões, no índice de performance) e do buy & hold (no preço de cada dia);
    Omega (soma dos dias positivos / soma dos negativos), Gain-to-Pain mensal (soma
    dos meses / soma das perdas mensais), profit factor, SQN (√n × média / desvio
    do retorno de cada trade sobre o capital, n até 100) e Kelly (W − (1 − W) /
    payoff). Cada um com a leitura, pelos níveis de RATIO_LEVELS."""
    days = max((end_ms - start_ms) / DAY_MS, 0.0)
    closes = prices.astype(float).copy()
    closes[-1] = float(minutes.close[-1])
    hold = _daily_stats(closes, days) if len(closes) > 1 and closes[0] > 0 else {}

    with np.errstate(divide="ignore", invalid="ignore"):
        daily = np.where(index[:-1] > 0, index[1:] / index[:-1] - 1, 0.0)
    losses = -float(daily[daily < 0].sum())
    omega = float(daily[daily > 0].sum()) / losses if losses > 0 else None

    monthly = [m["pct"] for m in months]
    monthly_losses = -sum(v for v in monthly if v < 0)
    gain_to_pain = sum(monthly) / monthly_losses if monthly_losses > 0 else None

    returns = np.array([t.capital_return for t in trades], dtype=float)
    sqn = None
    if len(returns) > 1 and float(returns.std(ddof=1)) > 1e-12:
        sqn = math.sqrt(min(len(returns), SQN_MAX_TRADES)) * float(returns.mean()) / float(returns.std(ddof=1))

    win = numbers.get("winRatePct")
    payoff = numbers.get("payoff")
    kelly = (win / 100 - (1 - win / 100) / payoff) * 100 if win is not None and payoff else None

    values = {
        "sharpe": (numbers.get("sharpe"), hold.get("sharpe")),
        "sortino": (numbers.get("sortino"), hold.get("sortino")),
        "calmar": (numbers.get("calmar"), hold.get("calmar")),
        "omega": (omega, None),
        "gainToPain": (gain_to_pain, None),
        "profitFactor": (numbers.get("profitFactor"), None),
        "sqn": (sqn, None),
        "kelly": (kelly, None),
    }
    return {
        "version": VERSION,
        "rows": [
            {"key": key, "value": _round(value), "buyHold": _round(hold_value), "rating": _rating(key, value)}
            for key, (value, hold_value) in values.items()
        ],
        "levels": RATIO_LEVELS,
        "sqnMaxTrades": SQN_MAX_TRADES,
    }


def capture_ratios(index: np.ndarray, prices, minutes: Candles) -> dict:
    """1.6 — Captura de subidas e descidas face ao ativo da simulação, nos retornos
    diários (UTC) do índice de performance e do preço do ativo: up capture (média
    da estratégia nos dias em que o ativo subiu ÷ média do ativo nesses dias) e
    down capture (o mesmo nos dias em que caiu), beta (covariância ÷ variância do
    ativo), alpha anual ((média − beta × média do ativo) × 365), correlação e
    batting average (% dos dias em que a estratégia fez mais do que o ativo)."""
    closes = prices.astype(float).copy()
    if len(closes):
        closes[-1] = float(minutes.close[-1])
    empty = {"version": VERSION, "upCapturePct": None, "downCapturePct": None, "beta": None,
             "alphaPct": None, "correlation": None, "battingAveragePct": None, "days": 0}
    if len(closes) < 3 or len(index) != len(closes) or np.any(closes <= 0):
        return empty
    with np.errstate(divide="ignore", invalid="ignore"):
        strategy = np.where(index[:-1] > 0, index[1:] / index[:-1] - 1, 0.0)
    asset = closes[1:] / closes[:-1] - 1

    up, down = asset > 0, asset < 0
    up_capture = float(strategy[up].mean() / asset[up].mean()) * 100 if up.any() else None
    down_capture = float(strategy[down].mean() / asset[down].mean()) * 100 if down.any() else None
    variance = float(np.var(asset, ddof=1))
    beta = float(np.cov(strategy, asset, ddof=1)[0, 1]) / variance if variance > 1e-18 else None
    alpha = (float(strategy.mean()) - beta * float(asset.mean())) * SHARPE_YEAR_DAYS * 100 if beta is not None else None
    deviation = float(np.std(strategy, ddof=1)) * math.sqrt(variance)
    correlation = float(np.cov(strategy, asset, ddof=1)[0, 1]) / deviation if deviation > 1e-18 else None
    return {
        "version": VERSION,
        "upCapturePct": _round(up_capture, 2),
        "downCapturePct": _round(down_capture, 2),
        "beta": _round(beta),
        "alphaPct": _round(alpha, 2),
        "correlation": _round(correlation),
        "battingAveragePct": _round(float((strategy > asset).mean()) * 100, 2),
        "days": int(len(asset)),
    }


def returns_scatter(marks, index: np.ndarray, prices, minutes: Candles) -> dict:
    """1.6 — Retornos diários: ativo vs estratégia. Um ponto por dia [retorno do
    ativo %, retorno da estratégia %, início do dia UTC] e a reta dos mínimos quadrados
    (estratégia = intercept + beta × ativo, em %): a inclinação é o beta. `rangePct`
    é o maior retorno em módulo dos dois, para o gráfico ficar simétrico."""
    closes = prices.astype(float).copy()
    if len(closes):
        closes[-1] = float(minutes.close[-1])
    empty = {"version": VERSION, "points": [], "beta": None, "interceptPct": None, "rangePct": 0.0}
    if len(closes) < 3 or len(index) != len(closes) or np.any(closes <= 0):
        return empty
    with np.errstate(divide="ignore", invalid="ignore"):
        strategy = np.where(index[:-1] > 0, index[1:] / index[:-1] - 1, 0.0) * 100
    asset = (closes[1:] / closes[:-1] - 1) * 100
    variance = float(np.var(asset, ddof=1))
    beta = float(np.cov(strategy, asset, ddof=1)[0, 1]) / variance if variance > 1e-18 else None
    intercept = float(strategy.mean()) - beta * float(asset.mean()) if beta is not None else None
    return {
        "version": VERSION,
        "points": [
            [round(float(a), 4) + 0.0, round(float(b), 4) + 0.0, int(t)]
            for a, b, t in zip(asset, strategy, marks[:-1])
        ],
        "beta": _round(beta),
        "interceptPct": _round(intercept),
        "rangePct": _round(max(float(np.abs(asset).max()), float(np.abs(strategy).max())), 4),
    }

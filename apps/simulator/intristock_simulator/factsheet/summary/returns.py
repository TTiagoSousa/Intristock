"""1.3 — Retornos por período e por horizonte, a distribuição diária, o Sharpe
móvel e o mês a mês."""

from __future__ import annotations

import math
from datetime import datetime, timedelta, timezone

import numpy as np

from ...market.candles import Candles
from ..columns import VERSION
from ..common import DAY_MS, SHARPE_YEAR_DAYS, STOP_REASONS, _round


def _month_start(year: int, month: int) -> int:
    """O início (ms, UTC) do mês; o mês 13 é janeiro do ano seguinte."""
    year, month = year + (month - 1) // 12, (month - 1) % 12 + 1
    return int(datetime(year, month, 1, tzinfo=timezone.utc).timestamp() * 1000)


def period_returns(marks, index: np.ndarray, start_ms: int, end_ms: int) -> dict:
    """1.3 — Tabela de retornos: o retorno em % de cada mês, trimestre e ano (UTC),
    no índice de performance (sem depósitos): o valor no fim sobre o do início do
    período, ou do bocado dele que a simulação apanha (`partial`). E o do período todo."""

    def at(t: int) -> float:
        i = int(np.clip(np.searchsorted(marks, t, side="left"), 0, len(marks) - 1))
        return float(index[i])

    def ret(a: int, b: int):
        lo, hi = max(a, start_ms), min(b, end_ms)
        if hi <= lo:
            return None
        first = at(lo)
        pct = (at(hi) / first - 1) * 100 if first > 0 else 0.0
        return round(pct, 3) + 0.0, bool(a < start_ms or b > end_ms)

    first = datetime.fromtimestamp(start_ms / 1000, tz=timezone.utc)
    last = datetime.fromtimestamp((end_ms - 1) / 1000, tz=timezone.utc)
    months, quarters, years = [], [], []
    for year in range(first.year, last.year + 1):
        for month in range(1, 13):
            got = ret(_month_start(year, month), _month_start(year, month + 1))
            if got:
                months.append({"year": year, "month": month, "pct": got[0], "partial": got[1]})
        for quarter in range(1, 5):
            got = ret(_month_start(year, quarter * 3 - 2), _month_start(year, quarter * 3 + 1))
            if got:
                quarters.append({"year": year, "quarter": quarter, "pct": got[0], "partial": got[1]})
        got = ret(_month_start(year, 1), _month_start(year, 13))
        if got:
            years.append({"year": year, "pct": got[0], "partial": got[1]})
    total = (float(index[-1]) / float(index[0]) - 1) * 100 if index[0] > 0 else 0.0
    return {
        "version": VERSION,
        "months": months,
        "quarters": quarters,
        "years": years,
        "totalPct": round(total, 3) + 0.0,
    }


# Os horizontes da tabela, em meses para trás do fim; só os mais curtos do que a simulação
HORIZON_MONTHS = [("1m", 1), ("3m", 3), ("6m", 6), ("1y", 12), ("3y", 36), ("5y", 60)]


def _months_before(ms: int, months: int) -> int:
    """O mesmo momento (UTC) N meses antes; o dia fica no último do mês se não existir."""
    moment = datetime.fromtimestamp(ms / 1000, tz=timezone.utc)
    total = moment.year * 12 + moment.month - 1 - months
    year, month = divmod(total, 12)
    month += 1
    last_day = (datetime(year + month // 12, month % 12 + 1, 1, tzinfo=timezone.utc) - timedelta(days=1)).day
    return int(moment.replace(year=year, month=month, day=min(moment.day, last_day)).timestamp() * 1000)


def horizon_returns(trades, marks, prices, index: np.ndarray, minutes: Candles, start_ms: int, end_ms: int,
                    fee_entry: float) -> dict:
    """1.3 — Por horizonte: nos últimos 1, 3 e 6 meses, 1, 3 e 5 anos (os que cabem)
    e no período todo, o retorno da estratégia (índice de performance, sem
    depósitos), o de comprar e manter (o preço, com a comissão de entrada), a
    diferença em pontos percentuais, a maior queda da estratégia dentro do
    intervalo e os trades fechados nele."""
    closes = prices.astype(float).copy()
    closes[-1] = float(minutes.close[-1])
    exits = np.sort(np.array([t.exit_time for t in trades], dtype=np.int64))

    def row(key: str, months, since: int) -> dict:
        i = int(np.clip(np.searchsorted(marks, since, side="left"), 0, len(marks) - 1))
        part = index[i:]
        strategy = (float(part[-1]) / float(part[0]) - 1) * 100 if part[0] > 0 else 0.0
        hold = ((1 - fee_entry) * closes[-1] / closes[i] - 1) * 100 if closes[i] > 0 else 0.0
        peaks = np.maximum.accumulate(part)
        with np.errstate(divide="ignore", invalid="ignore"):
            drawdown = np.where(peaks > 0, part / peaks - 1, 0.0)
        count = int(len(exits) - np.searchsorted(exits, int(marks[i]), side="left"))
        return {
            "key": key,
            "months": months,
            "fromTime": int(marks[i]),
            "toTime": int(end_ms),
            "days": round((end_ms - int(marks[i])) / DAY_MS),
            "strategyPct": _round(strategy, 3),
            "buyHoldPct": _round(hold, 3),
            "differencePp": _round(strategy - hold, 3),
            "maxDrawdownPct": _round(-float(drawdown.min()) * 100, 3),
            "trades": count,
        }

    rows = []
    for key, months in HORIZON_MONTHS:
        since = _months_before(end_ms, months)
        if since > start_ms:
            rows.append(row(key, months, since))
    rows.append(row("all", None, start_ms))
    return {"version": VERSION, "rows": rows}


# O histograma: um número ímpar de barras (a do meio centrada no 0) e o eixo até ao maior
# retorno diário em módulo, no máximo a este número de desvios (o resto entra nas barras das pontas)
DISTRIBUTION_BINS = 41
DISTRIBUTION_MAX_SIGMAS = 6


def daily_distribution(index: np.ndarray) -> dict:
    """1.3 — Distribuição dos retornos diários (índice de performance, sem
    depósitos): quantos dias caem em cada barra, de −`rangePct` a +`rangePct`
    (simétrico, a do meio no 0; os de fora contam nas pontas), e quantos daria
    uma normal com a mesma média e desvio. Caudas acima da normal = risco escondido."""
    with np.errstate(divide="ignore", invalid="ignore"):
        daily = np.where(index[:-1] > 0, index[1:] / index[:-1] - 1, 0.0) * 100
    n = len(daily)
    mean = float(daily.mean()) if n else 0.0
    std = float(daily.std(ddof=1)) if n > 1 else 0.0
    biggest = float(np.abs(daily).max()) if n else 0.0
    span = min(biggest, DISTRIBUTION_MAX_SIGMAS * std) if std > 0 else biggest
    span = span or 1.0
    width = 2 * span / DISTRIBUTION_BINS
    edges = -span + width * np.arange(DISTRIBUTION_BINS + 1)
    slot = np.clip(np.floor((daily + span) / width).astype(int), 0, DISTRIBUTION_BINS - 1)
    counts = np.bincount(slot, minlength=DISTRIBUTION_BINS)

    def cdf(x: float) -> float:
        return 0.5 * (1 + math.erf((x - mean) / (std * math.sqrt(2)))) if std > 0 else float(x >= mean)

    normal = [n * (cdf(float(b)) - cdf(float(a))) for a, b in zip(edges[:-1], edges[1:])]
    return {
        "version": VERSION,
        "columns": ["fromPct", "toPct", "days", "normalDays"],
        "bins": [
            [round(float(a), 4) + 0.0, round(float(b), 4) + 0.0, int(c), round(v, 2)]
            for a, b, c, v in zip(edges[:-1], edges[1:], counts, normal)
        ],
        "rangePct": round(span, 4),
        "days": n,
        "meanPct": round(mean, 4) + 0.0,
        "stdPct": round(std, 4),
        "outsideDays": int(np.sum(np.abs(daily) > span)),
    }


ROLLING_SHARPE_DAYS = 60


def rolling_sharpe(marks, index: np.ndarray) -> dict:
    """1.3 — Sharpe em janela móvel: em cada dia, o Sharpe (anualizado com √365)
    dos últimos 60 retornos diários do índice de performance (sem depósitos).
    Sem oscilação na janela (fora do mercado) não há Sharpe: fica nulo."""
    with np.errstate(divide="ignore", invalid="ignore"):
        daily = np.where(index[:-1] > 0, index[1:] / index[:-1] - 1, 0.0)
    window = ROLLING_SHARPE_DAYS
    points = []
    values = []
    for end in range(window, len(daily) + 1):
        part = daily[end - window:end]
        std = float(part.std(ddof=1))
        value = float(part.mean()) / std * math.sqrt(SHARPE_YEAR_DAYS) if std > 1e-12 else None
        points.append([int(marks[end]), None if value is None else round(value, 4) + 0.0])
        if value is not None:
            values.append(value)
    return {
        "version": VERSION,
        "windowDays": window,
        "columns": ["time", "sharpe"],
        "points": points,
        "min": _round(min(values)) if values else None,
        "max": _round(max(values)) if values else None,
    }


def monthly_detail(trades, marks, values, index: np.ndarray, start_ms: int, end_ms: int) -> dict:
    """1.3 — Mês a mês (UTC): os trades fechados no mês, o win rate, os stops e os
    take profits, o P&L bruto (antes de comissões e funding; o slippage já está nos
    preços), as comissões, o funding (negativo = pago) e o P&L líquido; o retorno do
    mês e a maior queda dentro dele no índice de performance (com as posições
    abertas, sem depósitos) e o capital no fim (com os depósitos)."""

    def at(t: int) -> int:
        return int(np.clip(np.searchsorted(marks, t, side="left"), 0, len(marks) - 1))

    first = datetime.fromtimestamp(start_ms / 1000, tz=timezone.utc)
    last = datetime.fromtimestamp((end_ms - 1) / 1000, tz=timezone.utc)
    rows = []
    year, month = first.year, first.month
    while (year, month) <= (last.year, last.month):
        a, b = _month_start(year, month), _month_start(year, month + 1)
        lo, hi = max(a, start_ms), min(b, end_ms)
        i, j = at(lo), at(hi)
        closed = [t for t in trades if lo <= t.exit_time < hi or (b > end_ms and t.exit_time == end_ms)]
        fees = sum(t.fees for t in closed)
        funding = sum(t.funding for t in closed)
        net = sum(t.pnl for t in closed)
        part = index[i:j + 1]
        peaks = np.maximum.accumulate(part)
        with np.errstate(divide="ignore", invalid="ignore"):
            drawdown = np.where(peaks > 0, part / peaks - 1, 0.0)
        rows.append({
            "year": year,
            "month": month,
            "partial": bool(a < start_ms or b > end_ms),
            "trades": len(closed),
            "winRatePct": _round(sum(1 for t in closed if t.pnl > 0) / len(closed) * 100, 2) if closed else None,
            "stops": sum(1 for t in closed if t.exit_reason in STOP_REASONS),
            "takes": sum(1 for t in closed if t.exit_reason == "take_profit"),
            "grossPnl": _round(net + fees + funding, 2),
            "fees": _round(-fees, 2),
            "funding": _round(-funding, 2),
            "netPnl": _round(net, 2),
            "returnPct": _round((float(index[j]) / float(index[i]) - 1) * 100, 3) if index[i] > 0 else 0.0,
            "maxDrawdownPct": _round(-float(drawdown.min()) * 100, 3),
            "endCapital": _round(float(values[j]), 2),
        })
        year, month = (year + 1, 1) if month == 12 else (year, month + 1)
    return {"version": VERSION, "rows": rows}

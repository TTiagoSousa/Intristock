"""3.6 — Regimes de mercado (tendência e volatilidade)."""

from __future__ import annotations

import math

import numpy as np

from .. import factsheet as fs
from ..market.candles import Candles
from .common import _round


REGIME_TREND_DAYS = 200
REGIME_SLOPE_DAYS = 20
REGIME_VOL_DAYS = 30
REGIME_MIN_DAYS = 30


# 3.6 — Regimes de mercado


def _daily_closes(minutes: Candles):
    days = np.asarray(minutes.time, np.int64) // fs.DAY_MS
    last = np.flatnonzero(np.diff(days)).tolist() + [len(days) - 1]
    return days[last], np.asarray(minutes.close, float)[last]


def regimes(trades, marks: np.ndarray, prices: np.ndarray, index: np.ndarray, minutes: Candles) -> dict:
    """3.6 — Cada dia do período com o regime da véspera: tendência (alta se o
    fecho está acima da média de `REGIME_TREND_DAYS` dias e ela sobe nos
    últimos `REGIME_SLOPE_DAYS`; baixa no contrário; lateral no resto; sem
    dados antes de haver média) e volatilidade (a anualizada de
    `REGIME_VOL_DAYS` dias acima ou abaixo da mediana do período). Por regime:
    os dias, a estratégia e o comprar e manter (compostos e anualizados) e os
    trades pelo dia de entrada."""
    day_of, closes = _daily_closes(minutes)
    sma = np.full(len(closes), np.nan)
    if len(closes) >= REGIME_TREND_DAYS:
        kernel = np.convolve(closes, np.ones(REGIME_TREND_DAYS) / REGIME_TREND_DAYS, mode="valid")
        sma[REGIME_TREND_DAYS - 1:] = kernel
    slope = np.full(len(closes), np.nan)
    slope[REGIME_SLOPE_DAYS:] = sma[REGIME_SLOPE_DAYS:] - sma[:-REGIME_SLOPE_DAYS]
    log_returns = np.diff(np.log(np.where(closes > 0, closes, np.nan)), prepend=np.nan)
    vol = np.full(len(closes), np.nan)
    for i in range(REGIME_VOL_DAYS, len(closes)):
        vol[i] = np.nanstd(log_returns[i - REGIME_VOL_DAYS + 1:i + 1]) * math.sqrt(365)

    def trend_at(i: int) -> str:
        if i < 0 or np.isnan(sma[i]) or np.isnan(slope[i]):
            return "unknown"
        if closes[i] > sma[i] and slope[i] > 0:
            return "bull"
        if closes[i] < sma[i] and slope[i] < 0:
            return "bear"
        return "lateral"

    # O regime de cada dia do período (o dia que acaba em marks[k]) é o da véspera
    lookup = {int(d): i for i, d in enumerate(day_of)}
    day_trend, day_vol = [], []
    for k in range(1, len(marks)):
        before = lookup.get(int((marks[k - 1] - 1) // fs.DAY_MS), -1)
        day_trend.append(trend_at(before))
        day_vol.append(vol[before] if before >= 0 else np.nan)
    known = [v for v in day_vol if not np.isnan(v)]
    median = float(np.median(known)) if known else None
    day_level = ["unknown" if np.isnan(v) or median is None else ("high" if v > median else "low") for v in day_vol]
    with np.errstate(divide="ignore", invalid="ignore"):
        strategy_daily = np.where(index[:-1] > 0, index[1:] / index[:-1] - 1, 0.0)
        hold_daily = np.where(prices[:-1] > 0, prices[1:] / prices[:-1] - 1, 0.0)

    def regime_of(time_ms: int):
        k = int(np.searchsorted(marks, time_ms, side="right"))
        k = min(max(k, 1), len(marks) - 1)
        return day_trend[k - 1], day_level[k - 1]

    tagged = [(t, *regime_of(t.entry_time)) for t in trades]

    def row(days_mask, trade_list, key: str) -> dict:
        days = int(np.count_nonzero(days_mask))
        own = float(np.prod(1 + strategy_daily[days_mask])) - 1 if days else None
        hold = float(np.prod(1 + hold_daily[days_mask])) - 1 if days else None

        # Anualizado só com `REGIME_MIN_DAYS` dias ou mais (com poucos, o número não quer dizer nada)
        def yearly(value):
            if value is None or days < REGIME_MIN_DAYS or value <= -1:
                return None
            return (math.pow(1 + value, 365 / days) - 1) * 100

        pnl = sum(t.pnl for t in trade_list)
        return {
            "regime": key, "days": days, "daysPct": _round(days / len(day_trend) * 100, 2) if day_trend else None,
            "returnPct": _round(own * 100 if own is not None else None, 2), "annualPct": _round(yearly(own), 2),
            "buyHoldPct": _round(hold * 100 if hold is not None else None, 2), "buyHoldAnnualPct": _round(yearly(hold), 2),
            "trades": len(trade_list),
            "winRatePct": _round(sum(1 for t in trade_list if t.pnl > 0) / len(trade_list) * 100, 2) if trade_list else None,
            "pnl": _round(pnl, 2), "expectancy": _round(pnl / len(trade_list), 2) if trade_list else None,
        }

    trend = np.array(day_trend)
    level = np.array(day_level)
    trend_rows = [row(trend == key, [t for t, a, _ in tagged if a == key], key)
                  for key in ("bull", "lateral", "bear", "unknown") if (trend == key).any()]
    vol_rows = [row(level == key, [t for t, _, b in tagged if b == key], key)
                for key in ("high", "low", "unknown") if (level == key).any()]
    grid = [[row((trend == a) & (level == b), [t for t, x, y in tagged if x == a and y == b], f"{a}:{b}")
             for b in ("high", "low")] for a in ("bull", "lateral", "bear")]
    head = {"version": fs.VERSION, "trendDays": REGIME_TREND_DAYS, "slopeDays": REGIME_SLOPE_DAYS,
            "volDays": REGIME_VOL_DAYS, "volMedianPct": _round(median * 100 if median is not None else None, 2)}
    return {
        "regimeTable": {**head, "trend": trend_rows, "volatility": vol_rows},
        "regimeGrid": {**head, "rows": ["bull", "lateral", "bear"], "columns": ["high", "low"], "cells": grid},
    }

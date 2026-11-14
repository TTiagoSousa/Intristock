"""3.8 — O desafio de uma prop firm: as regras dela vistas nos trades da simulação.

As regras (`strategy.propFirm`) não mudam os trades: avaliam-se depois, minuto a
minuto, no capital com as posições abertas — o realizado (o capital inicial e o
P&L dos trades fechados e das saídas parciais, sem depósitos, que uma conta de
prop firm não tem) mais o flutuante, ao pior preço de cada minuto (a mínima numa
compra, a máxima numa venda).

- Perda diária: o capital desce abaixo do do início do dia (na hora local da
  simulação, com as posições ao preço de fecho) menos `dailyLossPct`.
- Perda máxima: abaixo do inicial menos `maxLossPct` (`static`), ou do máximo
  já atingido menos esse valor (`trailing`, um valor fixo: `maxLossPct` do inicial).
- Objetivo: o capital realizado chega ao inicial mais `profitTargetPct`, com pelo
  menos `minTradingDays` dias com entradas. Passa se lá chegar antes de partir uma
  regra e dentro dos `days` dias.

O período todo é um desafio sem prazo, desde o início. As janelas são desafios
de `days` dias a começar em cada segunda-feira (meia-noite local): cada uma com
o capital reposto no início (os trades são os mesmos, por isso é uma
aproximação: com o tamanho em % do capital, escala na mesma proporção).
"""

from __future__ import annotations

import numpy as np

from .. import factsheet as fs
from ..market.candles import Candles
from .common import _round

DAY_MS = 86_400_000
# 1970-01-01 foi uma quinta-feira: o dia (desde então) de cada segunda-feira tem resto 4
MONDAY = 4


def _paths(trades, initial: float, minutes: Candles, first: int):
    """O capital realizado, o flutuante ao pior preço e ao fecho em cada minuto
    desde `first`, e os minutos em que os trades entraram."""
    size = len(minutes) - first
    realized = np.zeros(size)
    worst = np.zeros(size)
    close = np.zeros(size)
    entries = []
    times = minutes.time

    def index(time_ms: int) -> int:
        return int(np.searchsorted(times, time_ms, side="left")) - first

    for trade in trades:
        direction = 1 if trade.side == "long" else -1
        start, end = max(index(trade.entry_time), 0), min(index(trade.exit_time), size - 1)
        entries.append(index(trade.entry_time))
        quantity, cut, realized_parts = trade.quantity, start, 0.0
        segments = []
        for part in trade.partials or []:
            at = min(max(index(part["time"]), 0), size - 1)
            segments.append((cut, at, quantity))
            realized[at] += part["pnl"]
            realized_parts += part["pnl"]
            quantity -= part["quantity"]
            cut = at
        segments.append((cut, end, quantity))
        realized[end] += trade.pnl - realized_parts
        for a, b, held in segments:
            if b <= a:
                continue
            span = slice(first + a, first + b)
            extreme = minutes.low[span] if direction == 1 else minutes.high[span]
            worst[a:b] += direction * held * (extreme - trade.entry_price)
            close[a:b] += direction * held * (minutes.close[span] - trade.entry_price)
        # Os reforços flutuam desde que entraram até à saída, ao preço deles
        for add in trade.adds or []:
            a = min(max(index(add["time"]), 0), size - 1)
            if end <= a:
                continue
            span = slice(first + a, first + end)
            extreme = minutes.low[span] if direction == 1 else minutes.high[span]
            worst[a:end] += direction * add["quantity"] * (extreme - add["price"])
            close[a:end] += direction * add["quantity"] * (minutes.close[span] - add["price"])
    balance = initial + np.cumsum(realized)
    return balance, balance + worst, balance + close, np.array(sorted(entries), np.int64)


def _evaluate(rules: dict, balance, worst, close, days, entries, a: int, b: int, initial: float, before: float,
              times) -> dict:
    """Um desafio entre os minutos `a` e `b` (exclusivo), com o capital reposto no
    inicial (`before` é o capital ao fecho antes de `a`)."""
    scale = initial / before if before > 0 else 1.0
    real, low, eq = balance[a:b] * scale, worst[a:b] * scale, close[a:b] * scale
    day = days[a:b]
    # O capital no início de cada dia: o do fecho do minuto antes dele (no primeiro, o inicial)
    starts = np.flatnonzero(np.r_[True, day[1:] != day[:-1]])
    opening = np.r_[initial, eq[starts[1:] - 1]]
    day_start = np.repeat(opening, np.diff(np.r_[starts, len(day)]))

    breaches = []
    daily = rules.get("dailyLossPct")
    if daily:
        hit = np.flatnonzero(low < day_start * (1 - daily / 100))
        if len(hit):
            breaches.append((int(hit[0]), "daily"))
    peak = np.maximum.accumulate(np.maximum(eq, initial))
    max_loss = rules.get("maxLossPct")
    if max_loss:
        floor = peak - initial * max_loss / 100 if rules.get("maxLossMode") == "trailing" else initial * (1 - max_loss / 100)
        hit = np.flatnonzero(low < floor)
        if len(hit):
            breaches.append((int(hit[0]), "maxLoss"))
    breach = min(breaches) if breaches else None

    # Os dias com entradas, pela ordem: o objetivo só conta a partir do N.º dia
    inside = entries[(entries >= a) & (entries < b)] - a
    entry_days = []
    for minute in inside:
        if not entry_days or day[minute] != entry_days[-1][1]:
            entry_days.append((int(minute), int(day[minute])))
    passed = None
    target = rules.get("profitTargetPct")
    need = int(rules.get("minTradingDays") or 0)
    if target and len(entry_days) >= need:
        ready = entry_days[need - 1][0] if need else 0
        hit = np.flatnonzero(real[ready:] >= initial * (1 + target / 100))
        if len(hit):
            passed = ready + int(hit[0])

    if passed is not None and (breach is None or passed < breach[0]):
        outcome, at, rule = "passed", passed, None
    elif breach is not None:
        outcome, at, rule = "failed", breach[0], breach[1]
    else:
        outcome, at, rule = "open", None, None

    # A pior perda num dia e a maior queda desde o máximo, ao pior preço
    worst_day = (low - day_start) / day_start
    return {
        "outcome": outcome,
        "atMs": int(times[a + at]) if at is not None else None,
        "days": _round((times[a + at] - times[a]) / DAY_MS, 1) if at is not None else None,
        "rule": rule,
        "tradingDays": len(entry_days),
        "worstDailyPct": _round(float(worst_day.min()) * 100, 2) if len(worst_day) else None,
        "maxDrawdownPct": _round(float(((low - peak) / peak).min()) * 100, 2) if len(low) else None,
        "finalPct": _round((float(real[-1]) / initial - 1) * 100, 2) if len(real) else None,
    }


def prop_challenge(rules: dict | None, trades, initial: float, minutes: Candles, local, start_ms: int, end_ms: int,
                   deposits: bool) -> dict:
    """3.8 — O período todo como um desafio e as janelas de `days` dias que
    começam em cada segunda-feira (`propChallenge` e `propWindows`)."""
    if not rules:
        return {"propChallenge": None, "propWindows": None}
    first = int(np.searchsorted(minutes.time, start_ms, side="left"))
    head = {"version": fs.VERSION}
    if first >= len(minutes):
        return {"propChallenge": {**head, "available": False}, "propWindows": None}
    balance, worst, close, entries = _paths(trades, initial, minutes, first)
    times = minutes.time[first:]
    days = np.asarray(local(times)) // DAY_MS
    length = int(rules.get("days") or 30)

    whole = _evaluate(rules, balance, worst, close, days, entries, 0, len(times), initial, initial, times)

    # Uma janela a começar em cada segunda-feira que caiba inteira no período
    windows = []
    starts = np.flatnonzero(np.r_[True, days[1:] != days[:-1]])
    for a in starts:
        if (days[a] - MONDAY) % 7 or times[a] + length * DAY_MS > end_ms:
            continue
        b = int(np.searchsorted(times, times[a] + length * DAY_MS, side="left"))
        before = float(close[a - 1]) if a else initial
        result = _evaluate(rules, balance, worst, close, days, entries, int(a), b, initial, before, times)
        windows.append({"startMs": int(times[a]), "outcome": result["outcome"], "days": result["days"],
                        "rule": result["rule"], "finalPct": result["finalPct"]})

    count = len(windows)
    passed = [w for w in windows if w["outcome"] == "passed"]
    failed = [w for w in windows if w["outcome"] == "failed"]
    to_pass = [w["days"] for w in passed if w["days"] is not None]
    return {
        "propChallenge": {
            **head,
            "available": True,
            "rules": {
                "dailyLossPct": rules.get("dailyLossPct"),
                "maxLossPct": rules.get("maxLossPct"),
                "maxLossMode": rules.get("maxLossMode") or "static",
                "profitTargetPct": rules.get("profitTargetPct"),
                "minTradingDays": int(rules.get("minTradingDays") or 0),
                "days": length,
            },
            # Os depósitos ficam de fora (uma conta de prop firm não os tem)
            "deposits": deposits,
            "whole": whole,
            "windows": {
                "count": count,
                "passed": len(passed),
                "failed": len(failed),
                "failedDaily": sum(1 for w in failed if w["rule"] == "daily"),
                "failedMaxLoss": sum(1 for w in failed if w["rule"] == "maxLoss"),
                "open": count - len(passed) - len(failed),
                "passRatePct": _round(len(passed) / count * 100, 1) if count else None,
                "medianDaysToPass": _round(float(np.median(to_pass)), 1) if to_pass else None,
            },
        },
        "propWindows": {**head, "days": length, "windows": windows},
    }

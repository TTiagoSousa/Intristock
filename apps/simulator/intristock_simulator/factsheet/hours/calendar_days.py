"""5.5 — O calendário, dia a dia."""

from __future__ import annotations

from datetime import datetime, timedelta

import numpy as np

from ...market.candles import Candles
from ..columns import VERSION
from ..common import STOP_EXIT, _round
from ..equity import _equity_at


# 5.5: um dia conta como sem movimento abaixo deste valor em módulo (na moeda
# cotada), e as listas dos dias com mais stops e dos melhores dias têm este tamanho
CALENDAR_FLAT = 0.005
CALENDAR_LIST = 12


def _local_days(zone, start_ms: int, end_ms: int):
    """Os dias locais (no fuso `zone`) do período: a data de cada um e as
    fronteiras em ms UTC — o início, cada meia-noite local e o fim."""
    first = datetime.fromtimestamp(start_ms / 1000, zone).date()
    last = datetime.fromtimestamp((end_ms - 1) / 1000, zone).date()
    dates, marks = [], [start_ms]
    day = first
    while day <= last:
        dates.append(day)
        day += timedelta(days=1)
        midnight = int(datetime(day.year, day.month, day.day, tzinfo=zone).timestamp() * 1000)
        marks.append(min(midnight, end_ms))
    return dates, np.array(marks, np.int64)


def _longest_run(flags) -> int:
    best = run = 0
    for flag in flags:
        run = run + 1 if flag else 0
        best = max(best, run)
    return best


def calendar_report(trades, initial: float, deposits, deposit_amounts, minutes: Candles, zone, zone_name: str,
                    start_ms: int, end_ms: int) -> dict:
    """5.5 — O calendário, um dia local de cada vez: o P&L do dia é o da equity
    (com as posições abertas ao preço do fim do dia, sem os depósitos), e os
    trades e os stops contam-se pelo dia em que fecharam. Os 6 cartões, o mapa
    do ano, os dias com mais stops, os melhores dias, o dia do mês e as semanas."""
    dates, marks = _local_days(zone, start_ms, end_ms)
    _, equity, invested = _equity_at(trades, initial, deposits, deposit_amounts, minutes, marks)
    pnl = np.diff(equity) - np.diff(invested)
    count = len(dates)

    # Os trades fechados em cada dia (pela saída), os stops e as entradas
    closed = [[] for _ in range(count)]
    for trade in trades:
        index = int(np.searchsorted(marks, trade.exit_time, side="right")) - 1
        closed[min(max(index, 0), count - 1)].append(trade)
    stops = [sum(1 for t in day if t.exit_reason == STOP_EXIT) for day in closed]

    def rules(group) -> list[dict]:
        counted: dict[int, int] = {}
        for t in group:
            counted[t.entry_rule] = counted.get(t.entry_rule, 0) + 1
        return [{"rule": rule, "count": n} for rule, n in sorted(counted.items())]

    def day_row(i: int) -> dict:
        return {"date": dates[i].isoformat(), "weekday": dates[i].weekday(), "pnl": _round(float(pnl[i]), 2),
                "trades": len(closed[i]), "stops": stops[i]}

    positive = [float(v) > CALENDAR_FLAT for v in pnl]
    negative = [float(v) < -CALENDAR_FLAT for v in pnl]
    traded = sum(1 for day in closed if day)
    best = int(np.argmax(pnl)) if count else None
    worst = int(np.argmin(pnl)) if count else None
    head = {"version": VERSION, "timezone": zone_name}
    cards = {
        **head,
        "days": count,
        "tradeDays": traded,
        "tradeDaysPct": _round(traded / count * 100, 2) if count else None,
        "positiveDays": sum(positive),
        "negativeDays": sum(negative),
        # Dos dias com movimento (os sem movimento não contam para nenhum dos lados)
        "positivePct": _round(sum(positive) / (sum(positive) + sum(negative)) * 100, 2) if any(positive) or any(negative) else None,
        "best": day_row(best) if best is not None and positive[best] else None,
        "worst": day_row(worst) if worst is not None and negative[worst] else None,
        "winStreak": _longest_run(positive),
        "lossStreak": _longest_run(negative),
        "stopDays": sum(1 for n in stops if n >= 2),
    }

    # O mapa: uma escala simétrica até ao percentil 95 dos dias com movimento (em módulo)
    moved = [abs(float(v)) for v, up, down in zip(pnl, positive, negative) if up or down]
    daily = {
        **head,
        "columns": ["date", "pnl", "trades", "stops"],
        "days": [[dates[i].isoformat(), _round(float(pnl[i]), 2), len(closed[i]), stops[i]] for i in range(count)],
        "scale": _round(float(np.percentile(moved, 95)), 2) if moved else None,
        # Abaixo disto (em módulo) o dia conta como sem movimento
        "flat": CALENDAR_FLAT,
    }

    order = sorted((i for i in range(count) if stops[i]), key=lambda i: (-stops[i], float(pnl[i])))
    stop_days = {**head, "rows": [{**day_row(i), "entries": rules(t for t in closed[i] if t.exit_reason == STOP_EXIT)}
                                  for i in order[:CALENDAR_LIST]]}
    total = float(pnl.sum())
    order = sorted((i for i in range(count) if positive[i]), key=lambda i: -float(pnl[i]))
    best_days = {**head, "netProfit": _round(total, 2), "rows": [
        {**day_row(i), "profitPct": _round(float(pnl[i]) / total * 100, 2) if total > 0 else None,
         "entries": rules(closed[i])} for i in order[:CALENDAR_LIST]]}

    # O dia do mês e os primeiros e últimos 5 dias de cada mês (pelo tamanho do mês)
    month_day = [0.0] * 31
    first5 = last5 = 0.0
    for day, value in zip(dates, pnl):
        month_day[day.day - 1] += float(value)
        size = ((day.replace(day=28) + timedelta(days=4)).replace(day=1) - timedelta(days=1)).day
        first5 += float(value) if day.day <= 5 else 0.0
        last5 += float(value) if day.day > size - 5 else 0.0
    month = {**head, "pnl": [_round(v, 2) for v in month_day], "first5": _round(first5, 2), "last5": _round(last5, 2)}

    # As semanas (de segunda a domingo): o P&L e os stops
    weeks: list[list] = []
    for i, day in enumerate(dates):
        start = (day - timedelta(days=day.weekday())).isoformat()
        if not weeks or weeks[-1][0] != start:
            weeks.append([start, 0.0, 0])
        weeks[-1][1] += float(pnl[i])
        weeks[-1][2] += stops[i]
    week = {**head, "columns": ["start", "pnl", "stops"],
            "weeks": [[start, _round(value, 2), n] for start, value, n in weeks],
            "positive": sum(1 for _, value, _ in weeks if value > CALENDAR_FLAT),
            "first": dates[0].isoformat() if dates else None, "last": dates[-1].isoformat() if dates else None}

    return {"calendarCards": cards, "calendarDaily": daily, "calendarStopDays": stop_days,
            "calendarBestDays": best_days, "calendarMonthDay": month, "calendarWeeks": week}

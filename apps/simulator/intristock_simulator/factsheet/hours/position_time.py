"""5.7 — Tempo em posição, momentos da sessão e funding."""

from __future__ import annotations

from datetime import datetime, timedelta, timezone

import numpy as np

from ...market.candles import Candles
from ..columns import VERSION
from ..common import DAY_MS, _round
from .exit_hours import NIGHT_HOURS
from .weekdays import _weekday


# 5.7: os momentos-chave da sessão (o fecho da vela diária em UTC e a abertura e
# o fecho de Nova Iorque na hora de lá, de segunda a sexta) e as cobranças de funding
SESSION_MOMENTS = [("dailyClose", "UTC", 0, 0, False), ("nyOpen", "America/New_York", 9, 30, True),
                   ("nyClose", "America/New_York", 16, 0, True)]
FUNDING_HOURS = [0, 8, 16]
DURATION_REASONS = ["stop_loss", "take_profit", "trailing_stop", "break_even", "signal", "time"]


def _instants(zone_name: str, hour: int, minute: int, weekdays_only: bool, start_ms: int, end_ms: int) -> np.ndarray:
    """Cada dia do período, à hora e minuto dados no fuso dado, em ms UTC."""
    from zoneinfo import ZoneInfo

    zone = timezone.utc if zone_name == "UTC" else ZoneInfo(zone_name)
    day = datetime.fromtimestamp(start_ms / 1000, zone).date() - timedelta(days=1)
    last = datetime.fromtimestamp(end_ms / 1000, zone).date()
    out = []
    while day <= last:
        if not weekdays_only or day.weekday() < 5:
            ms = int(datetime(day.year, day.month, day.day, hour, minute, tzinfo=zone).timestamp() * 1000)
            if start_ms < ms <= end_ms:
                out.append(ms)
        day += timedelta(days=1)
    return np.array(out, np.int64)


def _local_times(instants: np.ndarray, local) -> list[str]:
    """As horas locais (HH:MM) em que os instantes caem, da mais frequente."""
    if not len(instants):
        return []
    minutes_of_day = (np.asarray(local(instants), np.int64) % DAY_MS) // 60_000
    values, counts = np.unique(minutes_of_day, return_counts=True)
    order = sorted(range(len(values)), key=lambda i: (-counts[i], values[i]))
    return [f"{int(values[i]) // 60:02d}:{int(values[i]) % 60:02d}" for i in order]


def _holding(trades, instants: np.ndarray) -> tuple[np.ndarray, list]:
    """Em cada instante, se havia posição aberta (entrou antes e sai nele ou
    depois, como o funding), e os trades que lá estavam."""
    held = np.zeros(len(instants), bool)
    inside = []
    for trade in trades:
        lo = int(np.searchsorted(instants, trade.entry_time, side="right"))
        hi = int(np.searchsorted(instants, trade.exit_time, side="right"))
        if hi > lo:
            held[lo:hi] = True
            inside.append(trade)
    return held, inside


def position_time_report(trades, local, zone: str, start_ms: int, end_ms: int, minutes: Candles,
                         funding_times, funding_rates, funding_minutes) -> dict:
    """5.7 — Tempo em posição, na hora local: a duração média por hora de
    entrada, as posições abertas em média em cada hora do dia (pelo tempo), os
    momentos-chave da sessão e as horas de funding com posição aberta (e o que
    custaram, cobrança a cobrança, como no motor) e a duração por dia da semana
    e por saída. As durações são em velas do tempo gráfico da simulação."""
    hour_ms = 3_600_000
    head = {"version": VERSION, "timezone": zone}
    entry_local = np.asarray(local([t.entry_time for t in trades]), np.int64) if trades else np.empty(0, np.int64)

    by_hour = [[] for _ in range(24)]
    for trade, ms in zip(trades, entry_local):
        if trade.bars is not None:
            by_hour[int(ms // hour_ms) % 24].append(trade.bars)
    duration = {**head, "columns": ["hour", "trades", "avgBars"],
                "hours": [[h, len(v), _round(sum(v) / len(v), 2) if v else None] for h, v in enumerate(by_hour)]}

    # As posições abertas: o tempo de cada trade em cada hora UTC, somado na hora local dela
    first, last = start_ms // hour_ms, (end_ms - 1) // hour_ms
    slots = np.arange(first, last + 1, dtype=np.int64)
    slot_hour = (np.asarray(local(slots * hour_ms), np.int64) // hour_ms) % 24
    span = np.minimum((slots + 1) * hour_ms, end_ms) - np.maximum(slots * hour_ms, start_ms)
    seen = np.bincount(slot_hour, weights=span, minlength=24)
    held = np.zeros(24)
    for trade in trades:
        begin, end = max(trade.entry_time, start_ms), min(trade.exit_time, end_ms)
        if end <= begin:
            continue
        lo, hi = begin // hour_ms - first, (end - 1) // hour_ms - first
        own = slots[lo:hi + 1]
        overlap = np.minimum((own + 1) * hour_ms, end) - np.maximum(own * hour_ms, begin)
        held += np.bincount(slot_hour[lo:hi + 1], weights=overlap, minlength=24)
    positions = {**head, "open": [_round(float(held[h] / seen[h]), 4) if seen[h] else None for h in range(24)],
                 "nightHours": list(NIGHT_HOURS)}

    moments = []
    for key, zone_name, hour, minute, weekdays_only in SESSION_MOMENTS:
        instants = _instants(zone_name, hour, minute, weekdays_only, start_ms, end_ms)
        flags, inside = _holding(trades, instants)
        moments.append({"moment": key, "localTimes": _local_times(instants, local), "count": len(instants),
                        "withPosition": int(flags.sum()),
                        "pct": _round(float(flags.mean()) * 100, 2) if len(instants) else None,
                        "trades": len(inside), "pnl": _round(sum(t.pnl for t in inside), 2)})

    # O funding de cada cobrança, como no motor: com a posição aberta entre a entrada e a saída
    has_funding = len(funding_times) > 0
    paid = {h: 0.0 for h in FUNDING_HOURS}
    if has_funding:
        prices = minutes.open[funding_minutes].astype(float)
        charge_hour = (np.asarray(funding_times, np.int64) // hour_ms) % 24
        for trade in trades:
            lo = int(np.searchsorted(funding_times, trade.entry_time, side="right"))
            hi = int(np.searchsorted(funding_times, trade.exit_time, side="right"))
            if hi > lo:
                direction = 1 if trade.side == "long" else -1
                amounts = direction * trade.quantity * prices[lo:hi] * funding_rates[lo:hi]
                for h, amount in zip(charge_hour[lo:hi], amounts):
                    paid[int(h)] = paid.get(int(h), 0.0) + float(amount)
    charges = []
    for hour in FUNDING_HOURS:
        instants = _instants("UTC", hour, 0, False, start_ms, end_ms)
        flags, _ = _holding(trades, instants)
        charges.append({"hour": hour, "localTimes": _local_times(instants, local), "count": len(instants),
                        "withPosition": int(flags.sum()),
                        "pct": _round(float(flags.mean()) * 100, 2) if len(instants) else None,
                        "paid": _round(paid[hour], 2) if has_funding else None})

    # A duração por dia de entrada e até cada saída (só as que aconteceram)
    reasons = [r for r in DURATION_REASONS if any(t.exit_reason == r for t in trades)]
    rows = []
    for day in range(7):
        group = [t for t, ms in zip(trades, entry_local) if _weekday(int(ms)) == day and t.bars is not None]

        def mean_bars(items):
            return _round(sum(t.bars for t in items) / len(items), 2) if items else None

        rows.append({"day": day, "trades": len(group), "avgBars": mean_bars(group),
                     "byExit": [mean_bars([t for t in group if t.exit_reason == r]) for r in reasons]})

    return {
        "positionDuration": duration,
        "positionHours": positions,
        "sessionMoments": {**head, "moments": moments},
        "fundingHours": {**head, "funding": has_funding, "charges": charges},
        "durationByWeekday": {**head, "reasons": reasons, "rows": rows},
    }

"""5.8 a 5.10 — Filtros de horário e regras de sessão corridos no motor."""

import copy

from ... import factsheet
from ..constants import DAY_MS, HOUR_MS, MINUTE_MS
from ..simulate import run


def _hour_rule(hour: int) -> dict:
    """Uma hora local inteira, todos os dias (para `blockedTimes`)."""
    return {"days": [], "from": f"{hour:02d}:00", "to": f"{(hour + 1) % 24:02d}:00"}


def _schedule_report(bars, minutes, strategy, start_ms, end_ms, timeframe, funding, entries, trades, summary,
                     blocked_signals, initial, deposits, deposit_amounts, split_pct, clock, zone) -> dict:
    """5.8 a 5.10 — Os filtros de horário escolhidos só com a parte dentro da
    amostra e corridos no motor (cada um junta horas ou dias aos
    `blockedTimes`), as regras de sessão da 5.9 corridas no motor (janelas em
    UTC que fecham as posições, `_closedWindows`, ou horas UTC sem entradas,
    `_blockedUtc`), os gaps e as sessões mundiais."""
    split_ms = factsheet.split_time(trades, initial, deposits, deposit_amounts, minutes, start_ms, end_ms, split_pct)
    found = factsheet.filter_candidates(trades, clock.local, split_ms)
    current = summary["netProfitPct"]
    base = factsheet.variant_stats(trades, initial, deposits, deposit_amounts, minutes, start_ms, end_ms, split_ms)

    def lite(variant):
        return run(bars, minutes, variant, start_ms, lambda _: None, timeframe, funding, lite=True)

    def numbers(own_trades, own_summary) -> dict:
        own = factsheet.variant_stats(own_trades, initial, deposits, deposit_amounts, minutes, start_ms, end_ms, split_ms)
        out, base_out = own["outReturnPct"], base["outReturnPct"]
        return {
            "trades": len(own_trades),
            "stops": sum(1 for t in own_trades if t.exit_reason == factsheet.STOP_EXIT),
            "returnPct": factsheet._round(own_summary["netProfitPct"], 2),
            "maxDrawdownPct": factsheet._round(own["maxDrawdownPct"], 2),
            "deltaPct": factsheet._round(own_summary["netProfitPct"] - current, 2),
            "inReturnPct": factsheet._round(own["inReturnPct"], 2),
            "outReturnPct": factsheet._round(out, 2),
            "deltaOutPct": factsheet._round(out - base_out, 2) if out is not None and base_out is not None else None,
        }

    # As horas locais das aberturas de Londres (8h) e de Nova Iorque (9h30, e a hora a seguir)
    def local_hour(zone_name: str, hour: int, minute: int):
        times = factsheet._local_times(factsheet._instants(zone_name, hour, minute, True, start_ms, end_ms), clock.local)
        return int(times[0][:2]) if times else None

    london, new_york = local_hour("Europe/London", 8, 0), local_hour("America/New_York", 9, 30)
    opens = sorted({h for h in (london, new_york, None if new_york is None else (new_york + 1) % 24) if h is not None})
    worst_day = found["worstDay"]
    exit_hour = found["exitStopHour"]
    candidates = [
        ("worstHours", found["worstHours"], []),
        ("stopHours", found["stopHours"], []),
        ("worstDay", [], [worst_day] if worst_day is not None else []),
        ("bestHours", [h for h in range(24) if h not in found["bestHours"]] if found["bestHours"] else [], []),
        ("worstHoursDay", found["worstHours"] if worst_day is not None else [], [worst_day] if found["worstHours"] and worst_day is not None else []),
        ("exitStopHour", sorted({(exit_hour - 1) % 24, exit_hour}) if exit_hour is not None else [], []),
        ("night", factsheet.FILTER_NIGHT_HOURS, []),
        ("opens", opens, []),
        ("weekdays", [], [5, 6]),
    ]
    filters = [{"filter": "current", "hours": [], "days": [], "keep": [], "signalsBlocked": blocked_signals,
                **numbers(trades, summary)}]
    done = set()
    for key, hours, days in candidates:
        signature = (tuple(sorted(hours)), tuple(sorted(days)))
        if (not hours and not days) or signature in done:
            continue
        done.add(signature)
        variant = copy.deepcopy(strategy)
        variant["blockedTimes"] = list(variant.get("blockedTimes") or []) + [_hour_rule(h) for h in sorted(hours)] + (
            [{"days": sorted(days)}] if days else [])
        own_trades, own_summary, own = lite(variant)
        filters.append({"filter": key, "hours": sorted(hours), "days": sorted(days),
                        "keep": found["bestHours"] if key == "bestHours" else [],
                        "signalsBlocked": own["funnel"]["blockedSchedule"], **numbers(own_trades, own_summary)})

    # As regras de sessão (em UTC)
    first_day, last_day = start_ms // DAY_MS - 7, end_ms // DAY_MS + 1
    weekend = [((day * DAY_MS) + 20 * HOUR_MS, (day + 2) * DAY_MS + 23 * HOUR_MS)
               for day in range(first_day, last_day + 1) if (day + 3) % 7 == 4]
    ny_close = [(int(ms), int(ms) + MINUTE_MS) for ms in factsheet._instants("America/New_York", 16, 0, False, start_ms, end_ms)]
    rules = [{"rule": "current", **numbers(trades, summary)}]
    for key, extra in (
        ("weekendClose", {"_closedWindows": weekend}),
        ("weekendNoEntry", {"_blockedUtc": [{"days": [5, 6]}]}),
        ("nyClose", {"_closedWindows": ny_close}),
        ("noMidnight", {"_blockedUtc": [{"days": [], "from": "00:00", "to": "01:00"}]}),
    ):
        own_trades, own_summary, _ = lite({**strategy, **extra})
        rules.append({"rule": key, **numbers(own_trades, own_summary)})

    head = {"version": factsheet.VERSION, "timezone": zone}
    report = {
        "hourFilters": {**head, "splitTime": split_ms, "configured": 0 < float(split_pct or 0) < 100, "rows": filters},
        "hourFilterWorst": {**head, "minTrades": factsheet.GRID_MIN_TRADES, "rows": found["worstTable"]},
        "hourFilterBest": {**head, "minTrades": factsheet.GRID_MIN_TRADES, "rows": found["bestTable"]},
    }
    report.update(factsheet.gaps_report(trades, entries, minutes, start_ms, end_ms, rules))
    report.update(factsheet.world_sessions_report(trades, clock.local, zone, minutes, start_ms, end_ms))
    return report

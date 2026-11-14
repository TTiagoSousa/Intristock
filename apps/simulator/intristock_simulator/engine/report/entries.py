"""4 — Entradas e saídas, com a estratégia sem cada entrada e os esquemas de risco."""

import copy

from ... import factsheet
from ..simulate import run


def _entries_report(bars, minutes, strategy, start_ms, end_ms, timeframe, funding, entries, trades, summary,
                    initial, deposits, deposit_amounts, split_pct, paths) -> dict:
    """4 — Entradas e saídas: os blocos de `factsheet` a partir do caminho de
    cada trade. A coluna «sem esta entrada» corre a estratégia sem ela, e os
    esquemas da 4.6 correm-na com o risco de cada entrada escolhido dentro da
    amostra (só nas estratégias de versão 3). `paths` é o caminho de cada trade
    (`factsheet.trade_paths`)."""
    columns = factsheet._exit_columns(paths)
    split_ms = factsheet.split_time(trades, initial, deposits, deposit_amounts, minutes, start_ms, end_ms, split_pct)
    current = summary["netProfitPct"]
    versioned = strategy.get("version", 1) >= 3

    def lite(variant):
        return run(bars, minutes, variant, start_ms, lambda _: None, timeframe, funding, lite=True)

    without = {}
    if versioned and len(entries) > 1:
        for index in range(len(entries)):
            variant = copy.deepcopy(strategy)
            del variant["entries"][index]
            without[index + 1] = lite(variant)[1]["netProfitPct"]

    performance = factsheet.entry_performance(paths, entries, split_ms, current, without)
    anatomy = factsheet.trade_anatomy(paths, bars)
    kelly = factsheet.entry_kelly(paths, entries, split_ms)
    return {
        "entryCards": factsheet.entry_cards(performance),
        "entryPerformance": performance,
        "entryEquity": factsheet.entry_equity(paths, entries, start_ms, end_ms),
        "entryExitMatrix": factsheet.entry_exit_matrix(paths, entries, columns),
        "exitMix": factsheet.exit_mix(paths, entries, columns),
        "stopCards": factsheet.stop_cards(paths, minutes),
        "exitReasons": factsheet.exit_reasons(paths, columns),
        "stopsByMonth": factsheet.stops_by_month(paths, start_ms, end_ms),
        "afterExit": factsheet.after_exit(paths, bars, minutes),
        "rDistribution": factsheet.r_distribution(paths),
        "maeScatter": factsheet.mae_scatter(paths),
        "durationBuckets": factsheet.duration_buckets(paths),
        "sizingSchemes": _sizing_schemes(
            strategy, entries, kelly, lite, initial, deposits, deposit_amounts, minutes, start_ms, end_ms, split_ms
        ) if versioned else {"version": factsheet.VERSION, "available": False, "reason": "version", "rows": []},
        "entryKelly": kelly,
        "entryCorrelation": factsheet.entry_correlation(paths, entries, start_ms, end_ms),
        "tradeAnatomy": anatomy,
        "tradePath": factsheet.trade_path(paths, bars, anatomy["separationBar"]),
        "exitEfficiency": factsheet.exit_efficiency(paths, entries, columns),
        "nextTrade": factsheet.next_trade(paths),
        "tradeGroups": factsheet.trade_groups(paths),
    }


def _sizing_schemes(strategy, entries, kelly, lite, initial, deposits, deposit_amounts, minutes, start_ms, end_ms,
                    split_ms) -> dict:
    """4.6 — Capital por tipo de entrada: cada esquema (`factsheet.scheme_risks`)
    corrido no motor com o tamanho de cada entrada pelo risco (`sizing` risk:
    a % do capital que perde no stop; 0 = desligada) e sem as regras de
    tamanho. Dá os trades, o retorno, a maior queda, o Calmar e, fora da
    amostra, o retorno, o PF e o Δ em p.p. contra o igual para todas. Precisa
    de um stop em todas as entradas."""
    if any((entry.get("stopLossMode") or "pct") == "pct" and not entry.get("stopLossPct") for entry in entries):
        return {"version": factsheet.VERSION, "available": False, "reason": "noStop", "rows": []}
    rows, done = [], {}
    for scheme, risks in factsheet.scheme_risks(kelly):
        key = tuple(round(value, 6) for value in risks)
        if key not in done:
            variant = copy.deepcopy(strategy)
            variant.pop("sizingRules", None)
            for entry, risk in zip(variant["entries"], risks):
                entry["sizing"] = {"mode": "risk", "value": risk}
            own_trades, own_summary, extra = lite(variant)
            stats = factsheet.scheme_stats(
                own_trades, initial, deposits, deposit_amounts, minutes, start_ms, end_ms, split_ms
            )
            # Com o risco por trade a posição pode levar o capital todo e os reforços deixam de caber
            skipped = sum(add["noCapital"] for own in extra["addStats"] for add in own)
            done[key] = (len(own_trades), own_summary["netProfitPct"], stats, skipped)
        count, value, stats, skipped = done[key]
        rows.append({
            "scheme": scheme,
            "risks": [factsheet._round(risk, 3) for risk in risks],
            "trades": count,
            "returnPct": factsheet._round(value, 2),
            "maxDrawdownPct": factsheet._round(stats["maxDrawdownPct"], 2),
            "calmar": factsheet._round(stats["calmar"], 3),
            "outReturnPct": factsheet._round(stats["outReturnPct"], 2),
            "outProfitFactor": factsheet._round(stats["outProfitFactor"], 3),
            "deltaOutPp": None,
            "addsSkipped": skipped,
        })
    base = rows[0]["outReturnPct"] if rows else None
    for row in rows[1:]:
        if base is not None and row["outReturnPct"] is not None:
            row["deltaOutPp"] = factsheet._round(row["outReturnPct"] - base, 2)
    has_adds = any(entry.get("scaleIns") for entry in entries)
    return {"version": factsheet.VERSION, "available": True, "reason": None, "scaleIns": has_adds, "rows": rows}

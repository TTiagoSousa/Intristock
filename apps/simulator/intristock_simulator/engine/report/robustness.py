"""3.2 a 3.6 — As variantes da robustez."""

from ... import factsheet
from ... import robustness
from ..simulate import run


def _robustness_report(bars, minutes, strategy, start_ms, end_ms, timeframe, funding, trades, summary,
                       initial, deposits, deposit_amounts, split_pct) -> dict:
    """3.2 a 3.6 — A robustez: o Monte Carlo do índice, a estratégia corrida
    com cada parâmetro mexido (`robustness.parameters`, só nas estratégias de
    versão 3) e o mapa dos dois que mais mexem, o walk-forward com essas
    variantes, os custos mais altos e os regimes de mercado. As contas são do
    `robustness`; aqui só se correm as variantes (`lite`)."""
    split_ms = factsheet.split_time(trades, initial, deposits, deposit_amounts, minutes, start_ms, end_ms, split_pct)
    marks, prices, index = robustness.daily_index(trades, initial, deposits, deposit_amounts, minutes, start_ms, end_ms)

    def lite(variant):
        return run(bars, minutes, variant, start_ms, lambda _: None, timeframe, funding, lite=True)

    def numbers(own_trades, own_summary) -> dict:
        own = factsheet.variant_stats(own_trades, initial, deposits, deposit_amounts, minutes, start_ms, end_ms, split_ms)
        return {
            "trades": len(own_trades),
            "returnPct": factsheet._round(own_summary["netProfitPct"], 2),
            "maxDrawdownPct": factsheet._round(own["maxDrawdownPct"], 2),
            "outReturnPct": factsheet._round(own["outReturnPct"], 2),
            "profitFactor": factsheet._round(factsheet._profit_factor(own_trades), 3),
            "fees": factsheet._round(sum(t.fees for t in own_trades), 2),
        }

    current = numbers(trades, summary)
    report = dict(robustness.monte_carlo(marks, index))

    params = robustness.parameters(strategy) if strategy.get("version", 1) >= 3 else []
    runs, candidates = {}, [("current", index)]
    for param in params:
        for step in robustness.SENS_STEPS:
            own_trades, own_summary, _ = lite(robustness.apply(strategy, param, step))
            runs[(param["key"], step)] = numbers(own_trades, own_summary)
            candidates.append((f"{param['key']}@{step}", robustness.daily_index(
                own_trades, initial, deposits, deposit_amounts, minutes, start_ms, end_ms)[2]))

    # O mapa: os dois parâmetros com mais diferença entre os passos, mexidos juntos
    grid = None
    if len(params) >= 2:
        def spread(param):
            values = [runs[(param["key"], step)]["returnPct"] for step in robustness.SENS_STEPS]
            return max(values) - min(values)

        x, y = sorted(params, key=spread, reverse=True)[:2]
        cells = []
        for y_step in robustness.GRID_STEPS:
            line = []
            for x_step in robustness.GRID_STEPS:
                if x_step == 1.0 and y_step == 1.0:
                    line.append(current)
                    continue
                variant = robustness.apply(robustness.apply(strategy, x, x_step), y, y_step)
                own_trades, own_summary, _ = lite(variant)
                line.append(numbers(own_trades, own_summary))
            cells.append(line)

        def axis(param):
            return {key: param.get(key) for key in ("key", "kind", "ref", "index", "operand", "name", "timeframe", "value")}

        grid = {"available": True, "x": axis(x), "y": axis(y), "cells": cells,
                "xValues": [robustness._scaled(x, s) for s in robustness.GRID_STEPS],
                "yValues": [robustness._scaled(y, s) for s in robustness.GRID_STEPS]}
    report.update(robustness.sensitivity(params, runs, current, grid))
    report.update(robustness.walk_forward(marks, prices, index, trades, candidates))

    rows = []
    for key, fee_mult, slip_add in robustness.COST_VARIANTS:
        own_trades, own_summary, _ = lite(robustness.cost_variant(strategy, fee_mult, slip_add))
        own = numbers(own_trades, own_summary)
        rows.append({"variant": key, "feeMult": fee_mult, "slippageAdd": slip_add, **own,
                     "deltaPct": factsheet._round(own["returnPct"] - current["returnPct"], 2)})
    report["costStress"] = robustness.cost_stress(strategy, current, rows)
    report.update(robustness.regimes(trades, marks, prices, index, minutes))
    report["performanceCurve"] = robustness.performance_curve(marks, index)
    return report

"""2.3 — Variantes da ordem e do preço de execução."""

import copy

from ... import factsheet
from ..constants import EXECUTION_PRICES
from ..simulate import run


def _order_variants(bars, minutes, strategy, start_ms, timeframe, funding, entries, trades, summary, order_stats) -> dict:
    """2.3 — Variantes da ordem de cada entrada que entra por nível: a mesma
    estratégia corrida outra vez, só com a ordem dessa entrada mudada (uma vela
    sem acompanhar, o dobro das velas, cancelar ou não sem a condição, a
    mercado). Cada uma dá os trades da entrada, as ordens executadas e caídas e
    o retorno da estratégia toda, com a diferença para a atual em p.p."""
    if strategy.get("version", 1) < 3:
        return {"version": factsheet.VERSION, "entries": []}
    base_return = summary["netProfitPct"]
    result = []
    for index, entry in enumerate(entries):
        if (entry.get("price") or {"kind": "market"})["kind"] == "market":
            continue
        bars_now = max(1, int(entry.get("orderBars") or 1))
        current = {
            "market": False,
            "orderBars": bars_now,
            "orderTrack": bool(entry.get("orderTrack")),
            "orderCancel": bool(entry.get("orderCancel")),
        }
        options = [
            {"market": False, "orderBars": 1, "orderTrack": False, "orderCancel": False},
            {**current, "orderBars": max(2, bars_now * 2)},
        ]
        if bars_now > 1:
            options.append({**current, "orderCancel": not current["orderCancel"]})
        options.append({"market": True, "orderBars": 1, "orderTrack": False, "orderCancel": False})

        rows = [{
            **current,
            "current": True,
            "trades": sum(1 for trade in trades if trade.entry_rule == index + 1),
            "filled": order_stats["filled"][index],
            "expired": order_stats["expired"][index] + order_stats["cancelled"][index],
            "returnPct": factsheet._round(base_return, 2),
            "deltaPp": None,
        }]
        seen = [current]
        for option in options:
            # Com uma vela, acompanhar e cancelar não mudam nada
            if option["orderBars"] == 1 and not option["market"]:
                option = {**option, "orderTrack": False, "orderCancel": False}
            if option in seen or (option["orderBars"] == 1 and not option["market"] and current["orderBars"] == 1):
                continue
            seen.append(option)
            variant = copy.deepcopy(strategy)
            changed = variant["entries"][index]
            if option["market"]:
                changed["price"] = {"kind": "market"}
                changed.pop("orderBars", None)
            else:
                changed["orderBars"] = option["orderBars"]
            changed["orderTrack"] = option["orderTrack"]
            changed["orderCancel"] = option["orderCancel"]
            own_trades, own_summary, own = run(
                bars, minutes, variant, start_ms, lambda _: None, timeframe, funding, lite=True
            )
            stats = own["orderStats"]
            value = own_summary["netProfitPct"]
            rows.append({
                **option,
                "current": False,
                "trades": sum(1 for trade in own_trades if trade.entry_rule == index + 1),
                "filled": stats["filled"][index],
                "expired": stats["expired"][index] + stats["cancelled"][index],
                "returnPct": factsheet._round(value, 2),
                "deltaPp": factsheet._round(value - base_return, 2),
            })
        result.append({"rule": index + 1, "variants": rows})
    return {"version": factsheet.VERSION, "entries": result}


def _execution_variants(bars, minutes, strategy, start_ms, timeframe, funding, summary, drawdown) -> dict:
    """2.3 — Preço de execução das ordens a mercado: a estratégia corrida com cada
    `executionPrice` (a atual primeiro): trades, win rate, profit factor, retorno,
    a maior queda (no índice de performance, como no Resumo) e o Δ do retorno em
    p.p. contra a atual. Mede a sensibilidade ao preço de entrada."""
    current = strategy.get("executionPrice") or "open"
    base_return = summary["netProfitPct"]

    def row(mode, own_summary, own_drawdown, is_current):
        value = own_summary["netProfitPct"]
        return {
            "mode": mode,
            "current": is_current,
            "trades": own_summary["trades"],
            "winRatePct": factsheet._round(own_summary["winRate"], 2),
            "profitFactor": factsheet._round(own_summary["profitFactor"], 2),
            "returnPct": factsheet._round(value, 2),
            "maxDrawdownPct": factsheet._round(own_drawdown, 2),
            "deltaPp": None if is_current else factsheet._round(value - base_return, 2),
        }

    rows = [row(current, summary, drawdown, True)]
    for mode in EXECUTION_PRICES:
        if mode == current:
            continue
        variant = {**strategy, "executionPrice": mode}
        _, own_summary, own = run(bars, minutes, variant, start_ms, lambda _: None, timeframe, funding, lite=True)
        rows.append(row(mode, own_summary, own["maxDrawdownPct"], False))
    return {"version": factsheet.VERSION, "rows": rows}

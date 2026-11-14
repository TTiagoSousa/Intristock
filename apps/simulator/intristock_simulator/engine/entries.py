"""As entradas da estratégia (versões 1 a 3) e as ordens de cada uma."""

import numpy as np

from ..strategy import Chart, armed_signal, entry_signal, exit_level
from .models import Order


def normalize(strategy: dict) -> list[dict]:
    """As entradas, cada uma com o seu stop, take profit e saídas.

    A versão 2 tinha o stop e o take profit gerais (as entradas podiam ter os
    seus) e condições de saída para todas, ao mercado. A versão 1 tinha uma só
    entrada, com a direção e as condições soltas na estratégia.
    """
    if strategy.get("version", 1) >= 3:
        return strategy["entries"]

    entries = strategy.get("entries") or [{"side": strategy["side"], "conditions": strategy["conditions"]}]
    exits = [
        {"conditions": [condition], "price": {"kind": "market"}}
        for condition in strategy.get("exitConditions") or []
    ]
    return [
        {
            "side": entry["side"],
            "conditions": entry["conditions"],
            "stopLossPct": _first(entry.get("stopLossPct"), strategy.get("stopLossPct")),
            "takeProfitPct": _first(entry.get("takeProfitPct"), strategy.get("takeProfitPct")),
            "exits": exits,
        }
        for entry in entries
    ]


def _order(
    chart: Chart, conditions: list[dict], price: dict | None, match: str | None = None, setup: dict | None = None
) -> Order:
    bars = chart.bars
    # Com preparação, as condições só contam depois dela (strategy.armed_signal)
    events = {} if setup else None
    active = armed_signal(chart, entry_signal(chart, conditions, match), setup, events)
    price = price or {"kind": "market"}
    level = exit_level(chart, price)
    if price["kind"] == "market":
        return Order(True, level, active, np.flatnonzero(active), events)

    # Um nível acima da abertura apanha-se a subir, abaixo a descer
    with np.errstate(invalid="ignore"):
        above = level >= bars.open
        reached = np.where(above, bars.high >= level, bars.low <= level)
    return Order(False, level, active, np.flatnonzero(active & ~np.isnan(level) & reached), events)


def _first(*values):
    return next((value for value in values if value is not None), None)

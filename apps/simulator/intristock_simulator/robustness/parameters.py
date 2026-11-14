"""3.4 — Os parâmetros da estratégia, mexidos um a um e dois a dois."""

from __future__ import annotations

import copy

from .. import factsheet as fs
from .common import _round


SENS_STEPS = [0.8, 0.9, 1.1, 1.2]
GRID_STEPS = [0.8, 0.9, 1.0, 1.1, 1.2]

# 3.4 — Sensibilidade aos parâmetros

ENTRY_PARAMS = ["stopLossPct", "stopLossBars", "takeProfitPct", "takeProfitR", "trailingStopPct", "breakEvenPct"]
# As regras da entrada: (lista, campo, tipo do parâmetro)
RULE_PARAMS = [
    ("stopRules", "r", "stopRuleR"),
    ("stopRules", "pct", "stopRulePct"),
    ("stopRules", "trailPct", "stopRuleTrail"),
    ("stopRules", "bars", "stopRuleBars"),
    ("scaleIns", "r", "scaleInR"),
    ("scaleIns", "pct", "scaleInPct"),
    ("scaleIns", "sizePct", "scaleInSize"),
]
# Os valores das últimas N velas (o período mexe-se em todas as condições que usam o mesmo)
WINDOW_KINDS = ("highest", "lowest", "bullish", "bearish")
# Os que são velas (inteiros)
BAR_PARAMS = {"stopLossBars", "stopRuleBars", "setupBars", "window"}
# O perfil de volume (pelo id do indicador): a % da área de valor e o tamanho das linhas
PROFILE_PARAMS = {"profileVa": "vaPct", "profileRows": "rowSize"}


def parameters(strategy: dict) -> list[dict]:
    """Os parâmetros que se mexem: o período de cada média (pelo id do
    indicador, usado em todas as condições), o das últimas N velas (iguais
    juntam-se), o stop, o take, o trailing e o break-even de cada entrada que os
    tenha, as velas da preparação e os números dos ajustes do stop e dos reforços;
    num perfil de volume, a % da área de valor e o tamanho das linhas."""
    found = []
    used = set()
    _profiles(strategy.get("entries") or [], used)
    for indicator in strategy.get("indicators") or []:
        if indicator.get("kind") == "svp":
            if indicator["id"] not in used:
                continue
            for kind, field in PROFILE_PARAMS.items():
                found.append({"key": f"{kind}:{indicator['id']}", "kind": kind, "ref": indicator["id"],
                              "name": indicator.get("name"), "value": indicator.get(field) or (70 if field == "vaPct" else 24)})
            continue
        if indicator.get("period"):
            found.append({"key": f"ind:{indicator['id']}", "kind": "indicator", "ref": indicator["id"],
                          "name": indicator.get("name"), "timeframe": indicator.get("timeframe"),
                          "value": indicator["period"]})
    for number, entry in enumerate(strategy.get("entries") or [], start=1):
        for field in ENTRY_PARAMS:
            if entry.get(field):
                found.append({"key": f"{field}:{number}", "kind": field, "ref": number, "value": entry[field]})
        if (entry.get("setup") or {}).get("bars"):
            found.append({"key": f"setupBars:{number}", "kind": "setupBars", "ref": number,
                          "value": entry["setup"]["bars"]})
        for name, field, kind in RULE_PARAMS:
            for index, rule in enumerate(entry.get(name) or [], start=1):
                if rule.get(field):
                    found.append({"key": f"{kind}:{number}.{index}", "kind": kind, "ref": number, "index": index,
                                  "list": name, "field": field, "value": rule[field]})
    windows: dict = {}
    _windows(strategy.get("entries") or [], windows)
    for key, operand in windows.items():
        found.append({"key": f"window:{key}", "kind": "window", "ref": key, "operand": operand,
                      "timeframe": operand.get("timeframe"), "value": operand["period"]})
    return found


def _window_key(node: dict) -> str:
    return f"{node['kind']}.{node.get('field') or ''}.{node['period']}.{node.get('timeframe') or ''}"


def _windows(node, found: dict) -> None:
    """Os valores das últimas N velas que a estratégia usa (iguais juntam-se)."""
    if isinstance(node, dict):
        if node.get("kind") in WINDOW_KINDS and node.get("period"):
            found.setdefault(_window_key(node), {
                key: node[key] for key in ("kind", "field", "period", "timeframe") if node.get(key) is not None
            })
        for child in node.values():
            _windows(child, found)
    elif isinstance(node, list):
        for child in node:
            _windows(child, found)


def _profiles(node, found: set) -> None:
    """Os ids dos perfis de volume que a estratégia usa."""
    if isinstance(node, dict):
        if node.get("kind") == "profile" and node.get("indicator"):
            found.add(node["indicator"])
        for child in node.values():
            _profiles(child, found)
    elif isinstance(node, list):
        for child in node:
            _profiles(child, found)


def _scaled(param: dict, step: float):
    if param["kind"] == "indicator":
        return max(2, int(round(param["value"] * step)))
    if param["kind"] == "profileVa":
        return min(100.0, max(1.0, round(float(param["value"]) * step, 1)))
    if param["kind"] == "profileRows":
        return max(1, int(round(param["value"] * step)))
    if param["kind"] in BAR_PARAMS:
        return max(1, int(round(param["value"] * step)))
    return round(float(param["value"]) * step, 2)


def apply(strategy: dict, param: dict, step: float) -> dict:
    """A estratégia com um parâmetro × `step`."""
    variant = copy.deepcopy(strategy)
    value = _scaled(param, step)
    if param["kind"] == "indicator":
        def walk(node):
            if isinstance(node, dict):
                if node.get("indicator") == param["ref"] or (node.get("id") == param["ref"] and "period" in node):
                    node["period"] = value
                for child in node.values():
                    walk(child)
            elif isinstance(node, list):
                for child in node:
                    walk(child)
        walk(variant)
    elif param["kind"] in PROFILE_PARAMS:
        field = PROFILE_PARAMS[param["kind"]]

        def walk_profiles(node):
            if isinstance(node, dict):
                if node.get("indicator") == param["ref"] or (node.get("id") == param["ref"] and node.get("kind") == "svp"):
                    node[field] = value
                for child in node.values():
                    walk_profiles(child)
            elif isinstance(node, list):
                for child in node:
                    walk_profiles(child)
        walk_profiles(variant)
    elif param["kind"] == "window":
        def walk_windows(node):
            if isinstance(node, dict):
                if node.get("kind") in WINDOW_KINDS and node.get("period") and _window_key(node) == param["ref"]:
                    node["period"] = value
                for child in node.values():
                    walk_windows(child)
            elif isinstance(node, list):
                for child in node:
                    walk_windows(child)
        walk_windows(variant["entries"])
    elif param["kind"] == "setupBars":
        variant["entries"][param["ref"] - 1]["setup"]["bars"] = value
    elif "list" in param:
        variant["entries"][param["ref"] - 1][param["list"]][param["index"] - 1][param["field"]] = value
    else:
        variant["entries"][param["ref"] - 1][param["kind"]] = value
    return variant


def sensitivity(params: list[dict], runs: dict, current: dict, grid: dict | None) -> dict:
    """3.4 — Cada parâmetro com o resultado de cada passo (`runs[(key, step)]`,
    os números de uma variante) e o atual; a estabilidade é a % dos passos que
    ficam a ganhar, e o mapa dos dois parâmetros que mais mexem."""
    rows = []
    for param in params:
        steps = [{"step": step, "value": _scaled(param, step), **runs[(param["key"], step)]} for step in SENS_STEPS]
        values = [s["returnPct"] for s in steps] + [current["returnPct"]]
        rows.append({
            "key": param["key"], "kind": param["kind"], "ref": param["ref"], "index": param.get("index"),
            "operand": param.get("operand"), "name": param.get("name"),
            "timeframe": param.get("timeframe"), "value": param["value"], "steps": steps,
            "spreadPct": _round(max(values) - min(values), 2),
            "positivePct": _round(sum(1 for s in steps if s["returnPct"] > 0) / len(steps) * 100, 1),
        })
    every = [s for row in rows for s in row["steps"]]
    head = {"version": fs.VERSION, "steps": SENS_STEPS}
    return {
        "sensitivityParams": {
            **head, "current": current, "rows": rows,
            "positivePct": _round(sum(1 for s in every if s["returnPct"] > 0) / len(every) * 100, 1) if every else None,
            "outPositivePct": _round(
                sum(1 for s in every if (s["outReturnPct"] or 0) > 0) / len(every) * 100, 1) if every else None,
            # Em que percentil das variantes ficou a atual (perto de 100 = um pico isolado)
            "currentRank": _round(sum(1 for s in every if s["returnPct"] <= current["returnPct"]) / len(every) * 100, 1)
            if every else None,
        },
        "sensitivityGrid": {**head, "steps": GRID_STEPS, **grid} if grid else {**head, "available": False},
    }

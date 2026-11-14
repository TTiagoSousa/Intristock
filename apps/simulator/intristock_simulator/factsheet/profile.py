"""4.10 — O perfil de volume: onde estavam as entradas face à área de valor da
sessão anterior e a que distância do POC, como abrem as sessões face à área de
valor da anterior (e se voltam a ela e ao POC) e se o preço volta aos POC das
sessões passadas (os virgens). Só com uma estratégia que use o perfil; conta-se
com o primeiro perfil que ela usa, nas velas da simulação."""

from __future__ import annotations

import numpy as np

from ..market.candles import TIMEFRAME_MINUTES
from ..strategy.profile import profile_sessions
from .columns import VERSION
from .common import _round
from .rules import _group

# Onde estava o preço de entrada face à área de valor da sessão anterior
POSITION_KEYS = ("above", "upper", "lower", "below")
# A distância do preço de entrada ao POC anterior, em % (com o sinal: acima ou abaixo)
DISTANCE_EDGES = [-2.0, -1.0, -0.5, 0.0, 0.5, 1.0, 2.0]


def _first_profile(node) -> dict | None:
    """O primeiro valor do perfil de volume que a estratégia usa."""
    if isinstance(node, dict):
        if node.get("kind") == "profile":
            return node
        for child in node.values():
            found = _first_profile(child)
            if found:
                return found
    elif isinstance(node, list):
        for child in node:
            found = _first_profile(child)
            if found:
                return found
    return None


def _distance_key(value: float) -> str:
    """O intervalo de uma distância: "<-2", "-2:-1", …, ">2"."""
    edges = DISTANCE_EDGES
    if value < edges[0]:
        return f"<{edges[0]:g}"
    for low, high in zip(edges, edges[1:]):
        if value < high:
            return f"{low:g}:{high:g}"
    return f">{edges[-1]:g}"


def profile_report(paths: list[dict], bars, strategy: dict, timeframe: str) -> dict:
    """4.10 — `profileCards` (os cartões), `profilePosition` (os trades por onde
    entraram face à área de valor anterior) e `profileDistance` (pela distância ao
    POC anterior); sem perfil na estratégia, `available: False`."""
    head = {"version": VERSION}
    operand = _first_profile(strategy.get("entries") or [])
    if operand is None or not len(bars):
        empty = {**head, "available": False}
        return {"profileCards": empty, "profilePosition": empty, "profileDistance": empty}

    size = TIMEFRAME_MINUTES.get(timeframe, 0) * 60_000
    data = profile_sessions(bars, size, operand)
    first, last, levels = data["first"], data["last"], data["finished_values"]
    n = len(bars)
    indicator = next((item for item in strategy.get("indicators") or [] if item.get("id") == operand.get("indicator")), {})
    options = {
        "indicator": operand.get("indicator"),
        "name": indicator.get("name"),
        "session": operand.get("session") or "each",
        "exchange": operand.get("exchange") or "",
        "rowsLayout": operand.get("rowsLayout") or "rows",
        "rowSize": operand.get("rowSize"),
        "vaPct": operand.get("vaPct"),
    }

    # A sessão anterior acabada de cada vela (na abertura dela)
    done = np.searchsorted(last, np.arange(n) - 1, side="right") - 1

    # --- os trades pela posição face à área de valor anterior e pela distância ao POC
    by_position: dict[str, list] = {key: [] for key in POSITION_KEYS}
    by_distance: dict[str, list] = {}
    inside = 0
    for path in paths:
        bar = path["entryBar"]
        k = int(done[bar]) if 0 <= bar < n else -1
        if k < 0:
            continue
        poc, vah, val = levels[k][:3]
        price = path["trade"].entry_price
        key = "above" if price > vah else "below" if price < val else "upper" if price >= poc else "lower"
        by_position[key].append(path)
        inside += key in ("upper", "lower")
        by_distance.setdefault(_distance_key((price / poc - 1) * 100), []).append(path)
    counted = sum(len(items) for items in by_position.values())
    distance_keys = [f"<{DISTANCE_EDGES[0]:g}"] + [f"{a:g}:{b:g}" for a, b in zip(DISTANCE_EDGES, DISTANCE_EDGES[1:])] + [
        f">{DISTANCE_EDGES[-1]:g}"
    ]

    # --- as sessões: como abrem face à área de valor da anterior e o que fazem depois
    opened = {"above": 0, "inside": 0, "below": 0}
    returned = reached_poc = broke_out = 0
    for k in range(1, len(first)):
        poc, vah, val = levels[k - 1][:3]
        a, b = int(first[k]), int(last[k])
        open_ = float(bars.open[a])
        high, low = float(bars.high[a:b + 1].max()), float(bars.low[a:b + 1].min())
        if open_ > vah or open_ < val:
            opened["above" if open_ > vah else "below"] += 1
            # Voltou a entrar na área de valor e chegou ao POC
            returned += (low <= vah) if open_ > vah else (high >= val)
            reached_poc += low <= poc <= high
        else:
            opened["inside"] += 1
            broke_out += high > vah or low < val
    outside = opened["above"] + opened["below"]

    # --- os POC virgens: se o preço voltou a eles depois da sessão e quantas velas depois
    touched_after = []
    untouched = 0
    for k in range(len(first) - 1):
        poc = levels[k][0]
        start = int(last[k]) + 1
        hit = np.flatnonzero((bars.low[start:] <= poc) & (bars.high[start:] >= poc))
        if len(hit):
            touched_after.append(int(hit[0]) + 1)
        else:
            untouched += 1
    sessions_checked = len(touched_after) + untouched
    widths = (levels[:, 1] - levels[:, 2]) / levels[:, 0] * 100 if len(levels) else np.array([])

    cards = {
        **head,
        "available": True,
        **options,
        "sessions": int(len(first)),
        "vaWidthPct": _round(float(np.nanmean(widths)), 2) if len(widths) else None,
        "openedAbove": opened["above"],
        "openedInside": opened["inside"],
        "openedBelow": opened["below"],
        "openedOutsidePct": _round(outside / (len(first) - 1) * 100, 1) if len(first) > 1 else None,
        "returnedInsidePct": _round(returned / outside * 100, 1) if outside else None,
        "reachedPocPct": _round(reached_poc / outside * 100, 1) if outside else None,
        "brokeOutPct": _round(broke_out / opened["inside"] * 100, 1) if opened["inside"] else None,
        "nakedTouchedPct": _round(len(touched_after) / sessions_checked * 100, 1) if sessions_checked else None,
        "nakedMedianBars": _round(float(np.median(touched_after)), 1) if touched_after else None,
        "nakedUntouched": untouched,
        "tradesInsidePct": _round(inside / counted * 100, 1) if counted else None,
        "trades": counted,
    }
    position = {
        **head,
        "available": True,
        "rows": [{"key": key, **_group(by_position[key])} for key in POSITION_KEYS],
    }
    distance = {
        **head,
        "available": True,
        "rows": [{"key": key, **_group(by_distance.get(key, []))} for key in distance_keys],
    }
    return {"profileCards": cards, "profilePosition": position, "profileDistance": distance}

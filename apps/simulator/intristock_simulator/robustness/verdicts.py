"""O veredicto (robusta, frágil, inconclusiva) e as conclusões dos ecrãs 4 e 5."""

from __future__ import annotations

import math

from .. import factsheet as fs
from .common import _round
from .walk_forward import WF_WINDOWS


# Trades a partir dos quais o veredicto decide (abaixo, fica por decidir)
VERDICT_MIN_TRADES = 30
VERDICT_GOOD_TRADES = 100
# A % de stops que chegaram depois ao alvo a partir da qual o stop parece apertado
STOPS_REVERSED_PCT = 30


# O veredicto


def _value(kind: str, value) -> dict:
    return {"kind": kind, "value": value}


def verdicts(report: dict, trades: list) -> dict:
    """Cada teste de robustez passa (`pass`), falha (`fail`) ou fica por decidir
    (`unknown`), com os números que o ecrã escreve; o veredicto junta-os
    (robusto: nenhum a falhar e pelo menos 5 a passar; frágil: 3 ou mais a
    falhar; inconclusivo no resto ou com menos de `VERDICT_MIN_TRADES`
    trades). E as conclusões de cada ecrã (Provas, Entradas e saídas,
    Horários), cada uma com o tom."""
    tests = []

    def test(key: str, state: str, **values):
        tests.append({"key": key, "state": state, "values": values})

    count = len(trades)
    test("sample", "pass" if count >= VERDICT_GOOD_TRADES else "fail" if count < VERDICT_MIN_TRADES else "unknown",
         trades=_value("number", count), good=_value("number", VERDICT_GOOD_TRADES))

    split = {row["key"]: row for row in (report.get("sampleSplit") or {}).get("rows", [])}
    annual = split.get("annualReturnPct", {})
    inside, outside = annual.get("inside"), annual.get("outside")
    if inside is not None and outside is not None:
        test("outOfSample", "pass" if outside > 0 else "fail" if inside > 0 else "unknown",
             inside=_value("pct", _round(inside, 2)), outside=_value("pct", _round(outside, 2)))

    mc = report.get("monteCarloCards") or {}
    if mc.get("available"):
        loss = mc["lossPct"]
        test("monteCarlo", "pass" if loss < 20 else "fail" if loss > 40 else "unknown",
             loss=_value("pct", loss), drawdown=_value("pct", mc["drawdownP95"]), real=_value("pct", mc["realDrawdownPct"]))

    sens = report.get("sensitivityParams") or {}
    if sens.get("rows"):
        share = sens["positivePct"]
        test("sensitivity", "pass" if share >= 80 else "fail" if share < 50 else "unknown",
             share=_value("pct", share), rank=_value("pct", sens["currentRank"]))

    wf = report.get("walkForwardCards") or {}
    if wf.get("available"):
        good = wf["positiveWindows"]
        test("walkForward", "pass" if good >= math.ceil(WF_WINDOWS * 2 / 3) else "fail" if good <= WF_WINDOWS // 3 else "unknown",
             positive=_value("number", good), windows=_value("number", WF_WINDOWS),
             chain=_value("pct", wf["walkForwardPct"]))

    costs = report.get("costStress") or {}
    fee2 = next((row for row in costs.get("rows", []) if row["variant"] == "fee2"), None)
    if fee2:
        test("costs", "pass" if fee2["returnPct"] > 0 else "fail",
             doubled=_value("pct", fee2["returnPct"]), breakeven=_value("mult", costs.get("breakEvenFeeMult")))

    trend = [r for r in (report.get("regimeTable") or {}).get("trend", []) if r["regime"] != "unknown"]
    if trend:
        winners = [r["regime"] for r in trend if (r["returnPct"] or 0) > 0]
        test("regimes", "pass" if len(winners) >= 2 else "fail" if not winners or winners == ["bull"] else "unknown",
             winners=_value("regimes", winners), total=_value("number", len(trend)))

    best_days = (report.get("calendarBestDays") or {}).get("rows", [])
    shares = [r["profitPct"] for r in best_days[:5] if r.get("profitPct") is not None]
    if shares:
        top = sum(shares)
        test("concentration", "pass" if top <= 50 else "fail" if top > 100 else "unknown", share=_value("pct", _round(top, 1)))

    decided = [t for t in tests if t["key"] != "sample"]
    fails = sum(1 for t in decided if t["state"] == "fail")
    passes = sum(1 for t in decided if t["state"] == "pass")
    if count < VERDICT_MIN_TRADES:
        overall = "inconclusive"
    elif fails >= 3:
        overall = "fragile"
    elif fails == 0 and passes >= 5:
        overall = "robust"
    else:
        overall = "inconclusive"

    # As conclusões das Entradas e saídas
    entries = []
    performance = report.get("entryPerformance") or {}
    rows = [r for r in performance.get("rows", []) if r.get("trades")]
    best = max(rows, key=lambda r: r["pnl"], default=None)
    if best and best.get("profitSharePct") is not None and len(rows) > 1:
        entries.append({"key": "entryShare", "tone": "negative" if best["profitSharePct"] > 100 else "neutral",
                        "values": {"rule": _value("entry", best["rule"]), "share": _value("pct", best["profitSharePct"])}})
    cards = report.get("entryCards") or {}
    if cards.get("flips"):
        entries.append({"key": "entryFlips", "tone": "negative",
                        "values": {"count": _value("number", cards["flips"]), "total": _value("number", cards.get("entries"))}})
    without = cards.get("withoutWorst")
    if without and without["returnPct"] is not None and without["returnPct"] > without["currentReturnPct"]:
        entries.append({"key": "entryWithout", "tone": "positive",
                        "values": {"rule": _value("entry", without["rule"]), "without": _value("pct", without["returnPct"]),
                                   "current": _value("pct", without["currentReturnPct"])}})
    stops = report.get("stopCards") or {}
    if stops.get("reversedPct") is not None:
        # Muitos stops que depois chegaram ao alvo: o stop pode estar apertado
        high = stops["reversedPct"] > STOPS_REVERSED_PCT
        entries.append({"key": "stopsReversed" if high else "stopsReversedLow", "tone": "negative" if high else "positive",
                        "values": {"share": _value("pct", stops["reversedPct"]), "hours": _value("number", stops.get("reversalHours"))}})

    # As conclusões dos Horários
    hours = []
    filters = (report.get("hourFilters") or {}).get("rows", [])[1:]
    helped = [r for r in filters if (r.get("deltaOutPct") or 0) > 0 and (r.get("deltaPct") or 0) > 0]
    hours.append({"key": "filtersHelp" if helped else "filtersNone", "tone": "positive" if helped else "neutral",
                  "values": {"count": _value("number", len(helped)), "total": _value("number", len(filters)),
                             "filter": _value("filter", max(helped, key=lambda r: r["deltaOutPct"])["filter"]) if helped else _value("text", None)}})
    week = report.get("weekdayCards") or {}
    if week.get("week") and week.get("weekend"):
        hours.append({"key": "weekend", "tone": "negative" if (week["weekend"]["pnl"] or 0) < 0 else "positive",
                      "values": {"weekend": _value("money", week["weekend"]["pnl"]), "week": _value("money", week["week"]["pnl"])}})
    work = report.get("workHours") or {}
    if "workPnl" in work:
        hours.append({"key": "workHours", "tone": "neutral",
                      "values": {"work": _value("money", work["workPnl"]), "off": _value("money", work["offPnl"])}})
    rules = {r["rule"]: r for r in (report.get("sessionRules") or {}).get("rows", [])}
    better = [k for k, r in rules.items() if k != "current" and (r.get("deltaPct") or 0) > 0 and (r.get("deltaOutPct") or 0) > 0]
    if better:
        hours.append({"key": "sessionRule", "tone": "positive", "values": {"rule": _value("rule", better[0])}})

    return {
        "version": fs.VERSION,
        "overall": overall,
        "passes": passes,
        "fails": fails,
        "tests": tests,
        "screens": {"entries": entries, "hours": hours},
    }

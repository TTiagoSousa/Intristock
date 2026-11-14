"""2.2 e 4.9 — As regras da entrada para lá das condições: a preparação, as
condições da conta («só entra se»), os ajustes do stop e os reforços."""

from __future__ import annotations

from .columns import VERSION
from .common import _mean, _round, _win_rate


def _variant(row: dict, variant: tuple | None, current: float) -> None:
    """Junta à linha o que a estratégia fez sem a regra (`variant` = (trades,
    retorno, max DD), da corrida `lite`) e o Δ do retorno em p.p. contra a atual."""
    trades, value, drawdown = variant if variant else (None, None, None)
    row.update(
        withoutTrades=trades,
        withoutReturnPct=_round(value, 2),
        withoutMaxDrawdownPct=_round(drawdown, 2),
        deltaPp=_round(current - value, 2) if value is not None else None,
    )


def _group(paths: list[dict]) -> dict:
    """Trades, win rate, R médio e P&L médio de um grupo de trades."""
    trades = [p["trade"] for p in paths]
    return {
        "trades": len(trades),
        "winRatePct": _round(_win_rate(trades), 2),
        "avgR": _round(_mean(p["r"] for p in paths), 3),
        "avgPnl": _round(_mean(t.pnl for t in trades), 2),
        "pnl": _round(sum(t.pnl for t in trades), 2),
    }


def setup_funnel(entries: list[dict], setup: list[dict | None], signals_by_rule: list[int], trades: list) -> dict:
    """2.2 — A preparação de cada entrada que a tem: quantas vezes armou (estando
    desarmada), se cumpriu outra vez armada (recomeça a contagem), acabou sem
    sinal, foi cancelada e deu sinal (e a % das vezes que armou), as velas médias
    de armar ao sinal e o que veio depois: os sinais no funil e os trades."""
    rows = []
    for index, entry in enumerate(entries):
        events = setup[index] if index < len(setup) else None
        if not entry.get("setup") or events is None:
            continue
        arms, fired = len(events["arm"]), events["fire"]
        rows.append({
            "rule": index + 1,
            "bars": int(entry["setup"].get("bars") or 1),
            "arms": arms,
            "rearms": len(events["rearm"]),
            "expired": len(events["expire"]),
            "cancelled": len(events["cancel"]),
            "fired": len(fired),
            "firedPct": _round(len(fired) / arms * 100, 2) if arms else None,
            "avgBarsToSignal": _round(_mean(wait for _, wait in fired), 2),
            "signals": int(signals_by_rule[index]) if index < len(signals_by_rule) else 0,
            "trades": sum(1 for trade in trades if trade.entry_rule == index + 1),
        })
    return {"version": VERSION, "available": bool(rows), "entries": rows}


def context_rules(entries: list[dict], blocks: list[list[int]], signals_by_rule: list[int], variants: dict,
                  current: float) -> dict:
    """2.2 — Cada condição da conta («só entra se») de cada entrada: a regra, os
    sinais que parou (cada sinal conta na primeira que falhou) e a % dos sinais
    da entrada, e a estratégia corrida sem ela (`variants[(entrada, regra)]`)."""
    rows = []
    for index, entry in enumerate(entries):
        signals = int(signals_by_rule[index]) if index < len(signals_by_rule) else 0
        for number, item in enumerate(entry.get("context") or []):
            blocked = blocks[index][number] if index < len(blocks) and number < len(blocks[index]) else 0
            row = {
                "rule": index + 1,
                "index": number + 1,
                "kind": item.get("kind"),
                "scope": item.get("scope") or "all",
                "operator": item.get("operator"),
                "value": item.get("value"),
                "result": item.get("result"),
                "blocked": blocked,
                "blockedPct": _round(blocked / signals * 100, 2) if signals else None,
            }
            _variant(row, variants.get((index + 1, number + 1)), current)
            rows.append(row)
    return {"version": VERSION, "available": bool(rows), "rows": rows}


def stop_rule_stats(paths: list[dict], entries: list[dict], variants: dict, current: float) -> dict:
    """4.9 — Cada ajuste do stop de cada entrada: em quantos trades aconteceu
    antes da saída (e a % dos da entrada), quantos saíram no stop que ele pôs e
    como (win rate, R médio, P&L), os trades em que aconteceu contra os outros
    da entrada, e a estratégia corrida sem ele."""
    rows = []
    for index, entry in enumerate(entries):
        rule = index + 1
        own = [p for p in paths if p["rule"] == rule]
        for number, item in enumerate(entry.get("stopRules") or []):
            adjust = number + 1
            fired = [p for p in own if adjust in (p["trade"].stop_rules_fired or [])]
            exits = [p for p in own if p["exitKey"].endswith(f"@{rule}.{adjust}")]
            row = {
                "rule": rule,
                "index": adjust,
                "trigger": item.get("trigger") or "always",
                "to": item.get("to") or "entry",
                "r": item.get("r"),
                "pct": item.get("pct"),
                "trailPct": item.get("trailPct"),
                "bars": item.get("bars"),
                "fired": len(fired),
                "firedPct": _round(len(fired) / len(own) * 100, 2) if own else None,
                "exits": _group(exits),
                "whenFired": _group(fired),
                "notFired": _group([p for p in own if p not in fired]),
            }
            _variant(row, variants.get((rule, adjust)), current)
            rows.append(row)
    return {"version": VERSION, "available": bool(rows), "rows": rows}


def scale_in_stats(paths: list[dict], entries: list[dict], add_stats: list[list[dict]], variants: dict,
                   current: float) -> dict:
    """4.9 — Cada reforço de cada entrada: quantas vezes o preço (ou as condições)
    lá chegou antes da saída, quantos entraram (e quantos com menos do que o
    pedido, por falta de capital), os que não couberam no capital livre e os
    abaixo do mínimo; os trades com este reforço contra os sem nenhum, e a
    estratégia corrida sem ele."""
    rows = []
    for index, entry in enumerate(entries):
        rule = index + 1
        own = [p for p in paths if p["rule"] == rule]
        without_any = [p for p in own if not p["trade"].adds]
        for number, item in enumerate(entry.get("scaleIns") or []):
            stats = add_stats[index][number] if index < len(add_stats) and number < len(add_stats[index]) else {}
            added = [p for p in own if any(add.get("n") == number + 1 for add in p["trade"].adds or [])]
            row = {
                "rule": rule,
                "index": number + 1,
                "trigger": item.get("trigger") or "profit",
                "r": item.get("r"),
                "pct": item.get("pct"),
                "sizePct": item.get("sizePct"),
                "moveStop": bool(item.get("moveStop")),
                **{key: int(stats.get(key, 0)) for key in ("reached", "filled", "reduced", "noCapital",
                                                           "rejectedMinimum")},
                "withAdd": _group(added),
                "withoutAdds": _group(without_any),
            }
            _variant(row, variants.get((rule, number + 1)), current)
            rows.append(row)
    return {"version": VERSION, "available": bool(rows), "rows": rows}

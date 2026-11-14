"""4 — O caminho de cada trade (MAE, MFE, R, velas) e as colunas de saída."""

from __future__ import annotations

import numpy as np

from ...market.candles import Bars, Candles


def _exit_key(trade, entry: dict) -> str:
    """A coluna de uma saída: o motivo e o valor dela (stop_loss:2.5, time:36,
    signal:1.2 = a saída 2 da entrada 1). Stops iguais de entradas diferentes
    ficam na mesma coluna. Um stop que um ajuste mexeu tem coluna dele, com a
    entrada e o ajuste (stop_loss@1.2 = o ajuste 2 da entrada 1)."""
    reason = trade.exit_reason
    if reason in ADJUSTED_REASONS and trade.exit_rule:
        return f"{reason}@{trade.entry_rule}.{trade.exit_rule}"
    # O stop na mínima/máxima ou num nível e o take em R não têm uma % fixa
    value = {
        "stop_loss": entry.get("stopLossPct") if (entry.get("stopLossMode") or "pct") == "pct" else None,
        "take_profit": None if entry.get("takeProfitR") else entry.get("takeProfitPct"),
        "trailing_stop": entry.get("trailingStopPct"),
        "break_even": entry.get("breakEvenPct"),
        "time": entry.get("maxBars"),
    }.get(reason)
    if reason == "signal":
        return f"signal:{trade.entry_rule}.{trade.exit_rule or 0}"
    return f"{reason}:{_number_key(value)}" if value else reason


def _number_key(value) -> str:
    value = float(value)
    return str(int(value)) if value.is_integer() else f"{value:g}"


# Os motivos que um ajuste do stop (`stopRules`) pode dar
ADJUSTED_REASONS = ("stop_loss", "trailing_stop", "break_even")

# A ordem das colunas: stops, trailing, break-even, alvos, condições, tempo e o resto
EXIT_COLUMN_ORDER = ("stop_loss", "trailing_stop", "break_even", "take_profit", "signal", "time", "liquidation",
                     "opposite", "excluded", "end")


def _exit_columns(paths: list[dict]) -> list[dict]:
    """As colunas das saídas que aconteceram, por ordem: {key, reason, value,
    rule, exit, adjust, rules} (`value` = a % ou as velas; `rule`/`exit` nas
    condições; `rule`/`adjust` num stop mexido por um ajuste; `rules` = as
    entradas que saíram por ela, para o nome)."""
    columns: dict[str, dict] = {}
    for path in paths:
        key = path["exitKey"]
        column = columns.get(key)
        if column is None:
            reason, _, rest = key.partition(":")
            column = {"key": key, "reason": reason, "value": None, "rule": None, "exit": None, "adjust": None,
                      "rules": []}
            if "@" in key:
                reason, _, rest = key.partition("@")
                rule, _, adjust = rest.partition(".")
                column.update(reason=reason, rule=int(rule), adjust=int(adjust))
            elif reason == "signal":
                rule, _, exit_rule = rest.partition(".")
                column["rule"], column["exit"] = int(rule), int(exit_rule) or None
            elif rest:
                column["value"] = float(rest)
            columns[key] = column
        if path["rule"] not in column["rules"]:
            column["rules"].append(path["rule"])
    for column in columns.values():
        column["rules"].sort()
    return sorted(
        columns.values(),
        key=lambda c: (EXIT_COLUMN_ORDER.index(c["reason"]) if c["reason"] in EXIT_COLUMN_ORDER else 99,
                       c["adjust"] is not None, -(c["value"] or 0), c["rule"] or 0, c["exit"] or 0, c["adjust"] or 0),
    )


def trade_paths(trades, entries: list[dict], bars: Bars, minutes: Candles) -> list[dict]:
    """O que o relatório 4 precisa de cada trade (pela ordem de saída) e que não
    se grava: a coluna da saída, as velas (do tempo gráfico) em que esteve
    aberto, a excursão adversa (MAE) e a favorável (MFE) em % do preço de
    entrada, o resultado em % do valor e em R (sobre quantidade × preço × a
    distância ao stop do trade; sem stop, nulo), o movimento do preço e os
    níveis planeados ao entrar."""
    paths = []
    for trade in sorted(trades, key=lambda t: (t.exit_time, t.entry_time)):
        entry = entries[trade.entry_rule - 1] if 0 < trade.entry_rule <= len(entries) else {}
        direction = 1 if trade.side == "long" else -1
        first = int(np.searchsorted(minutes.time, trade.entry_time, side="left"))
        last = min(int(np.searchsorted(minutes.time, trade.exit_time, side="left")), len(minutes) - 1)
        high = float(minutes.high[first:last + 1].max()) if last >= first else trade.entry_price
        low = float(minutes.low[first:last + 1].min()) if last >= first else trade.entry_price
        entry_bar = int(np.searchsorted(bars.time, trade.entry_time, side="right")) - 1
        # O minuto do melhor preço (o MFE) e a vela dele
        if last >= first:
            span = minutes.high[first:last + 1] if direction == 1 else -minutes.low[first:last + 1]
            peak = first + int(np.argmax(span))
            trough = first + int(np.argmax(-span))
        else:
            peak = trough = first
        peak_bar = int(np.searchsorted(bars.time, minutes.time[min(peak, len(minutes) - 1)], side="right")) - 1
        trough_bar = int(np.searchsorted(bars.time, minutes.time[min(trough, len(minutes) - 1)], side="right")) - 1
        exit_bar = int(np.searchsorted(bars.time, trade.exit_time, side="right")) - 1
        price = trade.entry_price
        if direction == 1:
            mae, mfe = (low / price - 1) * 100, (high / price - 1) * 100
        else:
            mae, mfe = (1 - high / price) * 100, (1 - low / price) * 100
        notional = trade.quantity * price
        stop_pct = float(trade.stop_pct or 0)
        paths.append({
            "trade": trade,
            "rule": trade.entry_rule,
            "direction": direction,
            "exitKey": _exit_key(trade, entry),
            "exitMinute": last,
            "exitBar": exit_bar,
            "entryBar": entry_bar,
            "bars": max(exit_bar - entry_bar, 1),
            "peakBars": max(peak_bar - entry_bar, 0),
            "troughBars": max(trough_bar - entry_bar, 0),
            "stopPct": stop_pct,
            "maePct": min(mae, 0.0),
            "mfePct": max(mfe, 0.0),
            "resultPct": trade.pnl / notional * 100 if notional > 0 else 0.0,
            "movePct": direction * (trade.exit_price / price - 1) * 100,
            "r": trade.pnl / (notional * stop_pct / 100) if stop_pct and notional > 0 else None,
            "stopLevel": trade.stop_level,
            "takeLevel": trade.take_level,
        })
    return paths

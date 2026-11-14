"""4.8 — A anatomia do trade: o caminho, a eficiência da saída, o trade seguinte
e os grupos (pirâmide, tipo de ordem, ordem no dia)."""

from __future__ import annotations

import bisect
import heapq

import numpy as np

from ...market.candles import Bars
from ..columns import VERSION
from ..common import DAY_MS, _initial_stop, _mean, _round, _win_rate


# 4.8: a distância (em R) entre a curva média dos que ganham e a dos que perdem
# que conta como "separaram-se", e até onde se seguem as curvas (velas)
SEPARATION_R = 0.5
SEPARATION_MAX_BARS = 500


def _separation_bar(paths: list[dict], bars: Bars) -> int | None:
    """A primeira vela, desde a entrada, em que o R médio dos trades que acabam a
    ganhar fica mais de `SEPARATION_R` acima do dos que acabam a perder. Cada
    trade conta o R ao fecho de cada vela enquanto está aberto e o final depois
    de sair; só os que têm stop (sem ele não há R)."""
    own = [p for p in paths if p["r"] is not None and p["stopPct"]]
    winners = [p for p in own if p["trade"].pnl > 0]
    losers = [p for p in own if p["trade"].pnl <= 0]
    if not winners or not losers:
        return None
    length = min(max(p["bars"] for p in own) + 1, SEPARATION_MAX_BARS)
    gap = _r_curve(winners, bars, length) - _r_curve(losers, bars, length)
    above = np.flatnonzero(gap > SEPARATION_R)
    return int(above[0]) if len(above) else None


def _r_curve(group: list[dict], bars: Bars, length: int) -> np.ndarray:
    """O R médio de um grupo em cada vela desde a entrada (0 = a vela da
    entrada): ao fecho da vela enquanto está aberto e o R final depois de sair."""
    total = np.zeros(length)
    for path in group:
        trade = path["trade"]
        risk = trade.entry_price * path["stopPct"] / 100
        start = path["entryBar"]
        held = min(path["exitBar"] - start, length - 1)
        closes = bars.close[start:start + held + 1].astype(float)
        values = np.full(length, path["r"])
        values[:len(closes)] = path["direction"] * (closes - trade.entry_price) / risk
        total += values
    return total / len(group)


def _after(paths: list[dict], won: bool) -> dict:
    """Os trades cuja última saída antes da entrada deles ganhou (ou perdeu): o R
    médio, a win rate e quantos."""
    exits = sorted((p["trade"].exit_time, p["trade"].pnl > 0) for p in paths)
    times = [time for time, _ in exits]
    own = []
    for path in paths:
        position = bisect.bisect_left(times, path["trade"].entry_time) - 1
        if position >= 0 and exits[position][1] == won:
            own.append(path)
    trades = [p["trade"] for p in own]
    return {
        "avgR": _round(_mean(p["r"] for p in own), 4),
        "winRatePct": _round(_win_rate(trades), 2),
        "trades": len(own),
    }


def trade_anatomy(paths: list[dict], bars: Bars) -> dict:
    """4.8 — Anatomia do trade, os 6 cartões: a captura do MFE (Σ movimento até à
    saída ÷ Σ MFE, nos trades com MFE; uma média de razões explodia nos que
    quase não andaram), as velas até ao melhor ponto e as totais, o trade a
    seguir a uma perda e a um ganho, a vela em que as curvas dos que ganham e
    dos que perdem se separam e a 2.ª posição da pirâmide (aberta com uma da
    mesma entrada já aberta: R médio, trades e P&L)."""
    moved = [p for p in paths if p["mfePct"] > 0]
    mfe_total = sum(p["mfePct"] for p in moved)
    position = _pyramid_positions(paths)
    second = [path for path in paths if position[id(path)] == 2]
    return {
        "version": VERSION,
        "mfeCapturePct": _round(sum(p["movePct"] for p in moved) / mfe_total * 100, 2) if mfe_total > 0 else None,
        "barsToPeak": _round(_mean(p["peakBars"] for p in paths), 2),
        "avgBars": _round(_mean(p["bars"] for p in paths), 2),
        "afterLoss": _after(paths, False),
        "afterWin": _after(paths, True),
        "separationBar": _separation_bar(paths, bars),
        "separationR": SEPARATION_R,
        "secondPosition": {
            "avgR": _round(_mean(p["r"] for p in second), 4),
            "trades": len(second),
            "pnl": _round(sum(p["trade"].pnl for p in second), 2),
        } if second else None,
    }


# 4.8: até onde vai o caminho médio (o percentil das velas abertas, entre um
# mínimo e um máximo; e sempre um pouco depois da separação)
PATH_PERCENTILE = 75
PATH_MIN_BARS = 10
PATH_MAX_BARS = 500
PATH_AFTER_SEPARATION = 5


def trade_path(paths: list[dict], bars: Bars, separation: int | None) -> dict:
    """4.8 — Caminho médio do trade em R desde a entrada: em cada vela, o R médio
    dos que acabam a ganhar, dos que acabam a perder e de todos (ao fecho da vela
    enquanto aberto, o final depois de sair). Até ao percentil 75 das velas
    abertas (entre 10 e 500), passando sempre a vela da separação. Só os trades
    com stop (sem ele não há R)."""
    own = [p for p in paths if p["r"] is not None and p["stopPct"]]
    if not own:
        return {"version": VERSION, "columns": ["bar", "winners", "losers", "all"], "points": [],
                "separationBar": None, "separationR": SEPARATION_R, "trades": 0}
    length = int(np.percentile([p["bars"] for p in own], PATH_PERCENTILE)) + 1
    if separation is not None:
        length = max(length, separation + PATH_AFTER_SEPARATION)
    length = min(max(length, PATH_MIN_BARS), PATH_MAX_BARS)
    winners = [p for p in own if p["trade"].pnl > 0]
    losers = [p for p in own if p["trade"].pnl <= 0]
    every = _r_curve(own, bars, length)
    won = _r_curve(winners, bars, length) if winners else None
    lost = _r_curve(losers, bars, length) if losers else None
    return {
        "version": VERSION,
        "columns": ["bar", "winners", "losers", "all"],
        "points": [
            [i, _round(won[i], 4) if won is not None else None, _round(lost[i], 4) if lost is not None else None,
             _round(every[i], 4)]
            for i in range(length)
        ],
        "separationBar": separation,
        "separationR": SEPARATION_R,
        "trades": len(own),
    }


def _efficiency_row(own: list[dict]) -> dict:
    moved = [p for p in own if p["mfePct"] > 0]
    mfe_total = sum(p["mfePct"] for p in moved)
    return {
        "trades": len(own),
        "mfePct": _round(_mean(p["mfePct"] for p in own), 4),
        "maePct": _round(_mean(p["maePct"] for p in own), 4),
        "capturePct": _round(sum(p["movePct"] for p in moved) / mfe_total * 100, 2) if mfe_total > 0 else None,
        "barsToMfe": _round(_mean(p["peakBars"] for p in own), 2),
        "barsToMae": _round(_mean(p["troughBars"] for p in own), 2),
    }


def exit_efficiency(paths: list[dict], entries: list[dict], columns: list[dict]) -> dict:
    """4.8 — Eficiência da saída, por grupo (todos, ganhos, perdidos, cada entrada
    e cada saída — as colunas da 4.2): trades, MFE e MAE médios (% do preço de
    entrada), a captura do MFE (Σ movimento até à saída ÷ Σ MFE, nos que têm
    MFE; negativa = o grupo devolve mais do que chegou a ter) e as velas até ao
    melhor e ao pior ponto."""
    rows = [
        {"group": "all", **_efficiency_row(paths)},
        {"group": "winners", **_efficiency_row([p for p in paths if p["trade"].pnl > 0])},
        {"group": "losers", **_efficiency_row([p for p in paths if p["trade"].pnl <= 0])},
    ]
    for index in range(1, len(entries) + 1):
        own = [p for p in paths if p["rule"] == index]
        if own:
            rows.append({"group": "entry", "rule": index, **_efficiency_row(own)})
    for column in columns:
        own = [p for p in paths if p["exitKey"] == column["key"]]
        if own:
            rows.append({"group": "exit", "exit": column, **_efficiency_row(own)})
    return {"version": VERSION, "rows": rows}


def _outcome_row(own: list[dict], repeat) -> dict:
    trades = [p["trade"] for p in own]
    return {
        "trades": len(own),
        "winRatePct": _round(_win_rate(trades), 2),
        "avgR": _round(_mean(p["r"] for p in own), 4),
        "pnl": _round(sum(t.pnl for t in trades), 2),
        "repeatPct": _round(sum(1 for p in own if repeat(p)) / len(own) * 100, 2) if own else None,
    }


def next_trade(paths: list[dict]) -> dict:
    """4.8 — O trade seguinte, conforme o que aconteceu antes (os trades que
    saíram antes da entrada dele, pela ordem de saída): depois de um ganho, de
    uma perda, de um stop, de dois ganhos e de duas perdas seguidas. Trades, win
    rate, R médio, P&L e a probabilidade de repetir (de voltar a ganhar, a
    perder ou a levar stop)."""
    exits = sorted(paths, key=lambda p: p["trade"].exit_time)
    times = [p["trade"].exit_time for p in exits]
    groups = {key: [] for key in ("win", "loss", "stop", "twoWins", "twoLosses")}
    for path in paths:
        position = bisect.bisect_left(times, path["trade"].entry_time) - 1
        if position < 0:
            continue
        last = exits[position]["trade"]
        groups["win" if last.pnl > 0 else "loss"].append(path)
        if _initial_stop(last):
            groups["stop"].append(path)
        if position >= 1:
            before = exits[position - 1]["trade"]
            if last.pnl > 0 and before.pnl > 0:
                groups["twoWins"].append(path)
            elif last.pnl <= 0 and before.pnl <= 0:
                groups["twoLosses"].append(path)

    def won(p):
        return p["trade"].pnl > 0

    def lost(p):
        return p["trade"].pnl <= 0

    def stopped(p):
        return _initial_stop(p["trade"])

    repeats = {"win": won, "loss": lost, "stop": stopped, "twoWins": won, "twoLosses": lost}
    return {
        "version": VERSION,
        "rows": [{"after": key, **_outcome_row(own, repeats[key])} for key, own in groups.items()],
    }


def _pyramid_positions(paths: list[dict]) -> dict[int, int]:
    """A posição de cada trade na pirâmide da sua entrada (por `id` do caminho):
    1 + as posições da mesma entrada abertas antes dele (entrada antes da sua e
    saída depois dela). Por ordem de entrada, com as saídas das abertas num
    heap: n log n — comparar cada trade com todos levava horas com dezenas de
    milhares de trades."""
    by_rule: dict[object, list[dict]] = {}
    for path in paths:
        by_rule.setdefault(path["rule"], []).append(path)
    position = {}
    for own in by_rule.values():
        own.sort(key=lambda p: p["trade"].entry_time)
        open_exits: list[int] = []
        index = 0
        while index < len(own):
            entry = own[index]["trade"].entry_time
            # Saem as que fecharam até esta entrada (a que fecha nesse instante já não conta)
            while open_exits and open_exits[0] <= entry:
                heapq.heappop(open_exits)
            # As que entram no mesmo instante não contam umas com as outras
            same = index
            while same < len(own) and own[same]["trade"].entry_time == entry:
                position[id(own[same])] = 1 + len(open_exits)
                same += 1
            for path in own[index:same]:
                heapq.heappush(open_exits, path["trade"].exit_time)
            index = same
    return position


def _group_row(own: list[dict]) -> dict:
    trades = [p["trade"] for p in own]
    return {
        "trades": len(own),
        "winRatePct": _round(_win_rate(trades), 2),
        "avgR": _round(_mean(p["r"] for p in own), 4),
        "pnl": _round(sum(t.pnl for t in trades), 2),
        "stopsPct": _round(sum(1 for t in trades if _initial_stop(t)) / len(own) * 100, 2),
        "avgBars": _round(_mean(p["bars"] for p in own), 2),
    }


def trade_groups(paths: list[dict]) -> dict:
    """4.8 — Pirâmide, tipo de ordem e ordem no dia: a posição na pirâmide (1.ª =
    sem outra da mesma entrada aberta, 2.ª = com uma, 3.ª ou mais), o tipo de
    ordem (a mercado, limite ou stop) e o primeiro trade do dia (UTC, pela
    entrada) contra os seguintes. Trades, win rate, R médio, P&L, % de stops e
    velas; só os grupos com trades."""
    position = _pyramid_positions(paths)
    by_entry = sorted(paths, key=lambda p: p["trade"].entry_time)
    first_of_day = set()
    seen_days = set()
    for path in by_entry:
        day = path["trade"].entry_time // DAY_MS
        if day not in seen_days:
            seen_days.add(day)
            first_of_day.add(id(path))
    groups = [
        ("pyramid1", [p for p in paths if position[id(p)] == 1]),
        ("pyramid2", [p for p in paths if position[id(p)] == 2]),
        ("pyramid3", [p for p in paths if position[id(p)] >= 3]),
        ("market", [p for p in paths if p["trade"].order_kind == "market"]),
        ("limit", [p for p in paths if p["trade"].order_kind == "limit"]),
        ("stop", [p for p in paths if p["trade"].order_kind == "stop"]),
        ("firstOfDay", [p for p in paths if id(p) in first_of_day]),
        ("laterInDay", [p for p in paths if id(p) not in first_of_day]),
    ]
    return {"version": VERSION, "rows": [{"group": key, **_group_row(own)} for key, own in groups if own]}

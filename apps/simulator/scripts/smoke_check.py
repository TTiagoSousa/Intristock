"""Verificação rápida do simulador, sem rede nem bases de dados (para o CI).

1. Importa todos os módulos do pacote (`intristock_simulator`, com o `live`).
2. Corre o motor sobre velas de 1 minuto inventadas (um passeio aleatório com
   semente fixa) com várias estratégias que passam pelas partes principais
   (ordens num nível, parciais, reforços, ajustes do stop, preparação, regras da
   conta, futuros com liquidação e funding, depósitos, regras gerais) e vê que
   corre e que duas corridas dão exatamente o mesmo.
3. Corre uma simulação com o relatório todo e vê que tem os blocos.
4. Corre o teste ao vivo (`LiveBot`) sobre as mesmas velas e vê que os trades
   fechados batem com os da simulação, também depois de ir e voltar em pickle
   (como para o processo do motor).
5. A caixa das atualizações ao vivo (`Mailbox`) junta as do mesmo minuto, e a
   leitura do ClickHouse em numpy (`load_minutes`) com um resultado a fingir.

Uso (em apps/simulator): `python scripts/smoke_check.py` (com `--quick` salta o
relatório completo). Sai com 0 se estiver tudo bem.
"""

from __future__ import annotations

import argparse
import asyncio
import dataclasses
import hashlib
import importlib
import json
import pickle
import pkgutil
import sys
import time
from pathlib import Path

ROOT = Path(__file__).resolve().parents[1]
sys.path.insert(0, str(ROOT))

import numpy as np  # noqa: E402

MINUTE_MS = 60_000
DAY_MS = 86_400_000
# 2024-01-01 00:00 UTC (uma segunda)
ORIGIN_MS = 1_704_067_200_000


def import_all() -> int:
    """Importa todos os módulos do pacote; devolve quantos."""
    package = importlib.import_module("intristock_simulator")
    importlib.import_module("intristock_simulator.live")
    count = 1
    for module in pkgutil.walk_packages(package.__path__, "intristock_simulator."):
        importlib.import_module(module.name)
        count += 1
    return count


def synthetic_minutes(days: int = 30, seed: int = 7, gaps: bool = False):
    """Velas de 1 minuto de um passeio aleatório (com semente: sempre as mesmas)."""
    from intristock_simulator.market.candles import Candles

    rng = np.random.default_rng(seed)
    count = days * 1440
    returns = rng.normal(0, 0.0012, count) + 0.00002 * np.sin(np.arange(count) / 2000)
    close = 30_000 * np.exp(np.cumsum(returns))
    open_ = np.r_[close[0], close[:-1]]
    spread = np.abs(rng.normal(0, 0.0008, count)) * close
    high = np.maximum(open_, close) + spread
    low = np.minimum(open_, close) - spread
    # Aos cêntimos, como num mercado: os últimos dígitos do exp mudam entre sistemas (Windows/Linux) e um preço
    # mesmo em cima de um nível mudava um trade; arredondados, as velas são as mesmas em todo o lado
    open_, high, low, close = (np.round(a, 2) for a in (open_, high, low, close))
    volume = rng.gamma(2.0, 5.0, count)
    times = ORIGIN_MS + np.arange(count, dtype=np.int64) * MINUTE_MS
    if gaps:
        # Minutos sem negócios (como na Coinbase): tira-se ~2%
        keep = rng.random(count) > 0.02
        keep[0] = keep[-1] = True
        times, open_, high, low, close, volume = (a[keep] for a in (times, open_, high, low, close, volume))
    return Candles(times, open_, high, low, close, volume)


def _ma(kind: str, period: int, field: str = "close", offset: int = -2, **extra) -> dict:
    return {"kind": kind, "field": field, "period": period, "offset": offset, **extra}


def _price(field: str, offset: int = -2) -> dict:
    return {"kind": "price", "field": field, "offset": offset}


BASE = {
    "version": 3,
    "initialCapital": 10_000,
    "feePct": 0.1,
    "timezone": "Europe/Lisbon",
}


def strategies() -> dict[str, dict]:
    """Estratégias que passam pelas partes principais do motor."""
    cross_up = {"left": _ma("sma", 10), "operator": "cross_above", "right": _ma("sma", 40)}
    cross_down = {"left": _ma("sma", 10), "operator": "cross_below", "right": _ma("sma", 40)}
    rsi_low = {"left": _ma("rsi", 14), "operator": "lt", "right": {"kind": "number", "value": 40}}
    rsi_high = {"left": _ma("rsi", 14), "operator": "gt", "right": {"kind": "number", "value": 60}}
    above_ema = {"left": _price("close"), "operator": "gt", "right": _ma("ema", 50)}
    return {
        "cross": {
            **BASE,
            "entries": [
                {"side": "long", "conditions": [cross_up], "stopLossPct": 1.5, "takeProfitPct": 3,
                 "exits": [{"conditions": [cross_down], "price": {"kind": "market"}}]},
            ],
        },
        "levels": {
            **BASE,
            "feeEntryPct": 0.02, "feeExitPct": 0.05, "slippagePct": 0.05,
            "maxPositions": 3, "opposite": "reverse", "cooldownBars": 2, "cooldownAfter": "loss",
            "blockedTimes": [{"days": [5, 6], "from": "00:00", "to": "06:00"}],
            "entries": [
                {"side": "long", "conditions": [rsi_low], "price": _price("low"),
                 "orderBars": 3, "orderTrack": True, "orderCancel": True, "maxPositions": 2,
                 "stopLossPct": 1, "takeProfitR": 2, "maxBars": 40,
                 "partialExits": [{"closePct": 50, "r": 1, "moveStop": True}],
                 "sizing": {"mode": "risk", "value": 1}},
                {"side": "short", "conditions": [rsi_high], "match": "any", "price": _price("high"),
                 "stopLossMode": "swing", "stopLossBars": 5, "stopLossBufferPct": 0.1, "takeProfitPct": 2,
                 "breakEvenPct": 0.7, "trailingStopPct": 1.2,
                 "schedule": {"mode": "except", "rules": [{"days": [], "from": "22:00", "to": "02:00"}]}},
            ],
        },
        "rules": {
            **BASE,
            "compounding": False, "executionPrice": "first_minute_avg",
            "quantityStep": 0.0001, "minQuantity": 0.0001, "minNotional": 10,
            "depositAmount": 500, "depositEvery": "month", "depositIncrease": {"amount": 100, "every": "quarter"},
            "dailyLimits": {"maxLosses": 3, "maxLossPct": 2},
            "tradingGuards": [{"event": "lossStreak", "value": 4, "pause": {"count": 1, "unit": "days"}},
                              {"event": "stops", "value": 5, "window": {"count": 2, "unit": "days"},
                               "pause": {"count": 12, "unit": "hours"}}],
            "sizing": {"mode": "percent", "value": 50},
            "sizingRules": [{"after": "losses", "count": 2, "action": "multiply", "value": 0.5, "trades": 3},
                            {"after": "wins", "count": 2, "action": "reset"}],
            "entries": [
                {"side": "long", "conditions": [above_ema, {"conditions": [cross_up, rsi_low], "match": "any"}],
                 "setup": {"conditions": [rsi_low], "bars": 20},
                 "context": [{"kind": "lossStreak", "scope": "all", "operator": "lt", "value": 6}],
                 "stopLossPct": 1.2, "takeProfitPct": 4,
                 "stopRules": [{"trigger": "profit", "r": 1, "to": "entry"},
                               {"trigger": "always", "to": "trail", "trailPct": 1.5}],
                 "scaleIns": [{"r": 0.5, "sizePct": 50, "moveStop": False},
                              {"trigger": "conditions", "conditions": [rsi_high], "sizePct": 25}]},
            ],
        },
        "futures": {
            **BASE,
            "leverage": 5, "marginMode": "cross", "maintenanceMarginPct": 0.5,
            "funding": {"mode": "fixed", "ratePct": 0.01}, "opposite": "hedge", "maxPositions": 2,
            "excludedPeriods": [{"from": "2024-01-10", "to": "2024-01-11"}],
            "entries": [
                {"side": "long", "conditions": [cross_up], "takeProfitPct": 6, "sizing": {"mode": "percent", "value": 80}},
                {"side": "short", "conditions": [cross_down], "leverage": 10, "stopLossPct": 4,
                 "exits": [{"conditions": [rsi_low], "price": _price("low")}]},
            ],
        },
        "isolated": {
            **BASE,
            "leverage": 20, "marginMode": "isolated", "sizing": {"mode": "amount", "value": 2000},
            "entries": [
                {"side": "long", "conditions": [rsi_low], "takeProfitPct": 3,
                 "scaleIns": [{"pct": 0.3, "sizePct": 100, "moveStop": True}]},
            ],
        },
    }


def _fingerprint(trades, summary, extra=None) -> str:
    payload = {
        "trades": [dataclasses.asdict(trade) for trade in trades],
        "summary": summary,
        "extra": extra,
    }
    text = json.dumps(payload, sort_keys=True, default=lambda value: repr(value))
    return hashlib.sha256(text.encode()).hexdigest()


def run_lite(name: str, strategy: dict, minutes, timeframe: str = "15m"):
    from intristock_simulator.engine import run
    from intristock_simulator.market.candles import to_bars

    bars = to_bars(minutes, timeframe)
    start_ms = ORIGIN_MS + 3 * DAY_MS
    trades, summary, report = run(bars, minutes, strategy, start_ms, lambda *_: None, timeframe, None, lite=True)
    return trades, summary, report


def check_engine() -> dict[str, str]:
    results = {}
    for gaps in (False, True):
        minutes = synthetic_minutes(gaps=gaps)
        for name, strategy in strategies().items():
            label = f"{name}{'+gaps' if gaps else ''}"
            first = run_lite(name, strategy, minutes)
            second = run_lite(name, json.loads(json.dumps(strategy)), minutes)
            a = _fingerprint(first[0], first[1], first[2])
            b = _fingerprint(second[0], second[1], second[2])
            if a != b:
                raise AssertionError(f"{label}: duas corridas deram resultados diferentes")
            if not first[0]:
                raise AssertionError(f"{label}: nenhum trade (as velas inventadas deviam dar alguns)")
            results[label] = a
            print(f"  {label:<16} {len(first[0]):>4} trades  {a[:12]}")
    return results


def check_report() -> None:
    from intristock_simulator import factsheet
    from intristock_simulator.engine import run
    from intristock_simulator.market.candles import to_bars

    minutes = synthetic_minutes(days=20)
    bars = to_bars(minutes, "1h")
    strategy = strategies()["cross"]
    started = time.monotonic()
    trades, summary, report = run(bars, minutes, strategy, ORIGIN_MS + 3 * DAY_MS, lambda *_: None, "1h", None)
    missing = [column for column in factsheet.REPORT_COLUMNS if column not in report]
    if missing:
        raise AssertionError(f"o relatório não tem os blocos {missing}")
    json.dumps(report, default=float)
    print(f"  relatório: {len(report)} blocos, {len(trades)} trades, {time.monotonic() - started:.1f}s")


def check_live() -> None:
    """O teste ao vivo, alimentado minuto a minuto no fim, decide como a simulação."""
    from intristock_simulator.engine import run
    from intristock_simulator.live.bot import LiveBot
    from intristock_simulator.live.exchanges import Minute
    from intristock_simulator.market.candles import Candles, to_bars

    minutes = synthetic_minutes(days=12)
    strategy = strategies()["levels"]
    start_ms = ORIGIN_MS + 3 * DAY_MS
    bot = LiveBot({"id": "smoke", "strategy": strategy, "timeframe": "15m", "start_ms": start_ms, "end_ms": None}, None)
    # O histórico menos as últimas 90 velas, que chegam uma a uma (como pelo WebSocket)
    head = len(minutes) - 90
    bot.add_closed_arrays(minutes.time[:head], minutes.open[:head], minutes.high[:head], minutes.low[:head],
                          minutes.close[:head], minutes.volume[:head])
    bot.rerun(int(minutes.time[head - 1]))
    from intristock_simulator.live.bot import rerun_in_process

    for index in range(head, len(minutes)):
        minute = Minute(int(minutes.time[index]), float(minutes.open[index]), float(minutes.high[index]),
                        float(minutes.low[index]), float(minutes.close[index]), float(minutes.volume[index]))
        if bot.on_minute(minute):
            if index % 2:
                bot.rerun(minute.time)
            else:
                # Como no serviço: o bot vai em pickle para o processo do motor e volta o que mudou
                _, result = rerun_in_process(pickle.loads(pickle.dumps(bot)), minute.time, False)
                bot.apply_engine_result(result)
    bot.close_if_quiet(int(minutes.time[-1]) + 10 * MINUTE_MS, 0)
    bot.rerun(int(minutes.time[-1]) + MINUTE_MS)
    if len(bot.times) != len(minutes):
        raise AssertionError(f"o teste ao vivo tem {len(bot.times)} minutos em vez de {len(minutes)}")
    # A mesma simulação sobre as mesmas velas: os trades fechados ao vivo têm de ser os dela
    candles = Candles(minutes.time, minutes.open, minutes.high, minutes.low, minutes.close, minutes.volume)
    trades, _, _ = run(to_bars(candles, "15m"), candles, strategy, start_ms, lambda *_: None, "15m", None,
                       lite=True, live={})
    expected = [(t.entry_rule, t.entry_time, t.exit_time, round(t.pnl, 9)) for t in trades]
    got = [(t["entryRule"], t["entryTime"], t["exitTime"], round(t["pnl"], 9)) for t in bot.state["trades"]]
    if sorted(expected) != sorted(got):
        raise AssertionError("o teste ao vivo não deu os mesmos trades que a simulação")
    print(f"  ao vivo: {len(got)} trades iguais aos da simulação, {len(bot.memory['opened'])} posições registadas")


def check_mailbox() -> None:
    from intristock_simulator.live.exchanges import Minute
    from intristock_simulator.live.service import Mailbox

    async def scenario():
        box = Mailbox()
        for close in range(500):
            box.put_nowait(("minute", Minute(60_000, 1.0, 1.0, 1.0, float(close), 0.0)))
        box.put_nowait(("connected", None))
        box.put_nowait(("minute", Minute(120_000, 1.0, 1.0, 1.0, 5.0, 0.0)))
        box.put_nowait(("minute", Minute(120_000, 1.0, 1.0, 1.0, 6.0, 0.0)))
        got = [await asyncio.wait_for(box.get(), 1) for _ in range(box.qsize())]
        return [(kind, value.close if value else None) for kind, value in got]

    got = asyncio.run(scenario())
    assert got == [("minute", 499.0), ("connected", None), ("minute", 6.0)], got


def check_clickhouse_numpy() -> None:
    from clickhouse_connect.datatypes.registry import get_from_name
    from clickhouse_connect.driver.npquery import NumpyResult

    from intristock_simulator.market import candles

    types = [get_from_name("Int64")] + [get_from_name("Float64")] * 5
    blocks = [
        [np.array([0, 60_000], np.int64)] + [np.array([1.0, 2.0])] * 5,
        [np.array([120_000], np.int64)] + [np.array([3.0])] * 5,
    ]

    class Client:
        def __init__(self, blocks):
            self.blocks = blocks

        def query_np(self, *_args, **_kwargs):
            return NumpyResult(iter(self.blocks), candles._MINUTE_COLUMNS, tuple(types),
                               [kind.np_type for kind in types]).np_result

    loaded = candles.load_minutes(Client(blocks), "x", None, None)
    assert loaded.time.tolist() == [0, 60_000, 120_000] and loaded.close.tolist() == [1.0, 2.0, 3.0]
    assert loaded.time.dtype == np.int64 and loaded.close.flags["C_CONTIGUOUS"]
    assert len(candles.load_minutes(Client([]), "x", None, None)) == 0


def main() -> int:
    parser = argparse.ArgumentParser()
    parser.add_argument("--quick", action="store_true", help="sem o relatório completo")
    parser.add_argument("--fingerprints", help="grava as impressões digitais das corridas neste ficheiro JSON")
    args = parser.parse_args()

    started = time.monotonic()
    print(f"imports: {import_all()} módulos")
    print("motor:")
    results = check_engine()
    if args.fingerprints:
        Path(args.fingerprints).write_text(json.dumps(results, indent=2, sort_keys=True), encoding="utf-8")
    print("ao vivo:")
    check_live()
    check_mailbox()
    print("  caixa das atualizações: ok")
    check_clickhouse_numpy()
    print("clickhouse em numpy: ok")
    if not args.quick:
        print("relatório:")
        check_report()
    print(f"ok ({time.monotonic() - started:.1f}s)")
    return 0


if __name__ == "__main__":
    sys.exit(main())

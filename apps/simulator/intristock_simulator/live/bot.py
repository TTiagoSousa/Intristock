"""Um teste ao vivo: as velas de 1 minuto até agora, o motor da simulação corrido
outra vez a cada minuto novo e o que mudou desde a corrida anterior (os registos).

Porquê correr tudo outra vez em vez de ir vela a vela: o motor decide na abertura
de cada vela só com o que já aconteceu, por isso o passado não muda quando chegam
velas novas, e assim o teste ao vivo decide exatamente como a simulação (as
mesmas contas, as mesmas regras). O minuto que está a decorrer entra só com a
abertura (é o preço a que se entra), e entra inteiro quando o seguinte começa.

Os registos saem da diferença entre o que o motor devolve agora e o que já foi
registado (`memory`, que se grava com o teste para continuar depois de um
reinício): as condições que mudaram, os sinais e o que lhes aconteceu, as ordens,
as posições abertas e fechadas, as parciais, os reforços, os passos do stop, os
depósitos e as pausas.

Os minutos guardam-se em arrays do numpy que crescem (`MinuteBuffer`), não em
listas de Python: ocupam ~4 vezes menos e o motor recebe-os sem conversões. A
corrida do motor (`rerun`) pode ir para outro processo (`rerun_in_process`): o
bot vai em pickle com os minutos e volta só o que mudou (`engine_result`).
"""

from __future__ import annotations

import math
from dataclasses import dataclass

import numpy as np

from ..engine import NoCandlesError, run
from ..engine.entries import normalize
from ..market.candles import Candles, to_bars
from ..strategy import entry_signal
from ..strategy.conditions import _condition
from .exchanges import MINUTE_MS, Minute

# Os registos já feitos que se guardam (para não repetir): os dos últimos dias;
# para trás conta-se tudo como registado
MEMORY_DAYS = 3
DAY_MS = 86_400_000
# Velas de decisão novas de uma vez (um reinício longo): só a última mostra as condições
MAX_CONDITION_BARS = 500
# Os minutos para que o buffer tem lugar no início (cresce para o dobro quando enche)
BUFFER_START = 4096
_FIELDS = ("time", "open", "high", "low", "close", "volume")


class MinuteBuffer:
    """Os minutos fechados em arrays do numpy com folga no fim (cresce para o
    dobro quando enche), mais um lugar para o minuto a decorrer."""

    def __init__(self, capacity: int = BUFFER_START):
        self.size = 0
        self._arrays = self._allocate(max(2, capacity))

    @staticmethod
    def _allocate(capacity: int) -> dict[str, np.ndarray]:
        return {name: np.empty(capacity, np.int64 if name == "time" else np.float64) for name in _FIELDS}

    def _reserve(self, needed: int) -> None:
        capacity = len(self._arrays["time"])
        if needed <= capacity:
            return
        while capacity < needed:
            capacity *= 2
        grown = self._allocate(capacity)
        for name in _FIELDS:
            grown[name][:self.size] = self._arrays[name][:self.size]
        self._arrays = grown

    def append(self, minute: Minute) -> None:
        self._reserve(self.size + 2)  # o minuto e o lugar do que está a decorrer
        index = self.size
        for name in _FIELDS:
            self._arrays[name][index] = getattr(minute, name)
        self.size += 1

    def extend(self, columns: dict[str, np.ndarray]) -> None:
        count = len(columns["time"])
        if not count:
            return
        self._reserve(self.size + count + 1)
        for name in _FIELDS:
            self._arrays[name][self.size:self.size + count] = columns[name]
        self.size += count

    def column(self, name: str) -> np.ndarray:
        return self._arrays[name][:self.size]

    def candles(self, current: Minute | None) -> Candles:
        """Os minutos fechados e, se vier, o que está a decorrer só com a abertura
        (escrito no lugar a seguir ao último: não se copia nada)."""
        size = self.size
        if current is not None:
            self._reserve(size + 1)
            price = current.open
            for name, value in zip(_FIELDS, (current.time, price, price, price, price, 0.0)):
                self._arrays[name][size] = value
            size += 1
        return Candles(*(self._arrays[name][:size] for name in _FIELDS))

    def __getstate__(self):
        # Em pickle (para o processo do motor) vão só os minutos, sem a folga
        return {"size": self.size, "arrays": {name: self._arrays[name][:self.size + 1].copy() for name in _FIELDS}}

    def __setstate__(self, state):
        self.size = state["size"]
        self._arrays = state["arrays"]


def _noop(*_args, **_kwargs) -> None:
    return None


@dataclass
class Slot:
    """Uma condição (ou um grupo) de uma entrada, da preparação ou de uma saída,
    ou o conjunto das condições de uma entrada (`met`)."""

    id: str
    scope: str  # entry | setup | exit | met
    entry: int  # 1, 2…
    exit: int | None
    path: list[int]  # a posição na lista (e no grupo)
    condition: dict | None
    group: bool = False


def condition_slots(entries: list[dict]) -> list[Slot]:
    slots: list[Slot] = []

    def walk(scope: str, entry: int, exit: int | None, conditions: list[dict]) -> None:
        for index, condition in enumerate(conditions or []):
            base = f"{scope}:{entry}:{exit or 0}:{index}"
            group = condition.get("conditions") is not None
            slots.append(Slot(base, scope, entry, exit, [index], condition, group))
            if group:
                for child_index, child in enumerate(condition["conditions"]):
                    slots.append(Slot(f"{base}.{child_index}", scope, entry, exit, [index, child_index], child))

    for number, entry in enumerate(entries, start=1):
        slots.append(Slot(f"met:{number}", "met", number, None, [], None))
        walk("entry", number, None, entry.get("conditions") or [])
        if entry.get("setup"):
            walk("setup", number, None, entry["setup"].get("conditions") or [])
        for exit_number, exit in enumerate(entry.get("exits") or [], start=1):
            walk("exit", number, exit_number, exit.get("conditions") or [])
    return slots


def _key(rule: int, entry_time: int) -> str:
    return f"{rule}:{entry_time}"


class LiveBot:
    def __init__(self, test: dict, memory: dict | None):
        self.id = test["id"]
        self.strategy = test["strategy"]
        self.timeframe = test["timeframe"]
        self.start_ms = test["start_ms"]
        self.end_ms = test["end_ms"]
        self.entries = normalize(self.strategy)
        self.slots = condition_slots(self.entries)
        self.fee_entry = float(self.strategy.get("feeEntryPct", self.strategy.get("feePct", 0))) / 100
        self.fee_exit = float(self.strategy.get("feeExitPct", self.strategy.get("feePct", 0))) / 100
        # Os minutos fechados e o que está a decorrer
        self.buffer = MinuteBuffer()
        self.current: Minute | None = None
        self.funding: tuple[np.ndarray, np.ndarray] | None = None
        self.memory = memory or {}
        self.memory.setdefault("opened", [])
        self.memory.setdefault("closed", [])
        self.memory.setdefault("parts", {})
        self.memory.setdefault("adds", {})
        self.memory.setdefault("moves", {})
        self.memory.setdefault("journal", [])
        self.memory.setdefault("setup", [])
        self.memory.setdefault("since", 0)
        self.memory.setdefault("deposits", 0)
        self.memory.setdefault("conditions", {})
        self.memory.setdefault("lastBar", 0)
        self.memory.setdefault("touched", [])
        # Para o preço ao vivo: cada posição aberta com o que é preciso para o P&L
        self.open_math: list[dict] = []
        self.capital = float(self.strategy["initialCapital"])
        self.state: dict = {}

    # --- as velas ----------------------------------------------------------
    @property
    def times(self) -> np.ndarray:
        """O início de cada minuto fechado (ms UTC)."""
        return self.buffer.column("time")

    @property
    def closes(self) -> np.ndarray:
        return self.buffer.column("close")

    @property
    def last_closed(self) -> int | None:
        return int(self.buffer.column("time")[-1]) if self.buffer.size else None

    def add_closed(self, minutes: list[Minute]) -> None:
        """Junta minutos fechados (o que faltou depois de uma ligação cair), por
        ordem e sem repetir."""
        if not minutes:
            return
        self.add_closed_arrays(*(np.asarray([getattr(minute, name) for minute in minutes]) for name in _FIELDS))

    def add_closed_arrays(self, times, opens, highs, lows, closes, volumes) -> None:
        """Junta minutos fechados em arrays (o histórico): como o `add_closed`,
        salta os que já existem (ou repetidos) e para no minuto a decorrer."""
        times = np.asarray(times, np.int64)
        if not len(times):
            return
        last = self.last_closed
        # Cada minuto tem de ser depois do último que já entrou (o de antes ou um destes)
        before = np.maximum.accumulate(np.r_[np.iinfo(np.int64).min if last is None else last, times[:-1]])
        keep = times > before
        if self.current is not None:
            late = np.flatnonzero(keep & (times >= self.current.time))
            if len(late):
                keep[late[0]:] = False
        if not keep.any():
            return
        self.buffer.extend({
            name: np.asarray(values, np.int64 if name == "time" else np.float64)[keep]
            for name, values in zip(_FIELDS, (times, opens, highs, lows, closes, volumes))
        })

    def _append(self, minute: Minute) -> None:
        self.buffer.append(minute)

    def on_minute(self, minute: Minute) -> bool:
        """A vela do minuto a decorrer mudou. Devolve True quando começa um minuto
        novo (o anterior fechou e já se sabe a abertura deste): é a altura de correr
        o motor outra vez."""
        last = self.last_closed
        if last is not None and minute.time <= last:
            return False
        if self.current is None or minute.time > self.current.time:
            if self.current is not None:
                self._append(self.current)
            self.current = minute
            return True
        self.current = minute
        return False

    def candles(self, until_ms: int | None = None, with_current: bool = True) -> Candles:
        """Os minutos para o motor: os fechados e o atual só com a abertura."""
        candles = self.buffer.candles(self.current if with_current else None)
        if until_ms is not None:
            cut = int(np.searchsorted(candles.time, until_ms, side="left"))
            candles = Candles(*(array[:cut] for array in (
                candles.time, candles.open, candles.high, candles.low, candles.close, candles.volume,
            )))
        return candles

    # --- o motor -----------------------------------------------------------
    def rerun(self, now_ms: int, final: bool = False) -> list[dict]:
        """Corre o motor com as velas até agora e devolve os registos novos (e
        atualiza `state`). `final`: o teste acabou (o fim ou parado), as posições
        abertas fecham como numa simulação que acaba (`end`)."""
        minutes = self.candles(self.end_ms if final and self.end_ms else None, with_current=not final)
        if not len(minutes):
            return []
        bars = to_bars(minutes, self.timeframe)
        live = None if final else {}
        try:
            trades, summary, _ = run(
                bars, minutes, self.strategy, self.start_ms, _noop, self.timeframe,
                self.funding, lite=True, live=live,
            )
        except NoCandlesError:
            # Ainda antes da primeira vela do teste (o aquecimento já está)
            self.state = self._waiting_state(minutes)
            return []
        events: list[dict] = []
        opened = list(live["open"]) if live else []
        self._trade_events(events, trades, opened, minutes)
        if live:
            self._journal_events(events, live, bars, minutes)
            self._deposit_events(events, live)
            self._setup_events(events, live, bars)
            self._condition_events(events, live, bars)
        events.sort(key=lambda item: (item["time"], item.get("order", 5)))
        for item in events:
            item.pop("order", None)
        self._prune(now_ms)
        self.state = self._build_state(trades, opened, live, minutes, bars, summary)
        return events

    def _waiting_state(self, minutes: Candles) -> dict:
        price = float(minutes.close[-1])
        return {
            "waitingFirstBar": True,
            "price": price,
            "priceTime": int(minutes.time[-1]),
            "capital": self.capital,
            "equity": self.capital,
            "unrealized": 0.0,
            "realized": 0.0,
            "initialCapital": float(self.strategy["initialCapital"]),
            "deposited": 0.0,
            "trades": [],
            "open": [],
            "pending": [],
            "pausedUntil": 0,
            "conditions": self.state.get("conditions", {}) if self.state else {},
            "conditionsBarTime": None,
            "setupArmed": [],
        }

    # --- os registos -------------------------------------------------------
    def _trade_events(self, events: list, trades, opened, minutes: Candles) -> None:
        memory = self.memory
        seen_open = set(memory["opened"])
        seen_closed = set(memory["closed"])

        def opened_event(key, rule, side, time_ms, price, quantity, stop, take, kind):
            if key in seen_open:
                return
            seen_open.add(key)
            memory["opened"].append(key)
            events.append({
                "time": time_ms, "order": 3, "kind": "opened",
                "data": {"key": key, "entry": rule, "side": side, "price": price, "quantity": quantity,
                         "stop": stop, "take": take, "orderKind": kind},
            })

        def follow_ups(key, rule, partials, adds, moves):
            # As parciais, os reforços e os passos do stop que ainda não se registaram
            for name, items, kind in (("parts", partials, "partial"), ("adds", adds, "add"), ("moves", moves, "stopMove")):
                done = memory[name].get(key, 0)
                for item in items[done:]:
                    events.append({"time": item["time"], "order": 4, "kind": kind, "data": {"key": key, "entry": rule, **item}})
                memory[name][key] = max(done, len(items))

        for trade in trades:
            key = _key(trade.entry_rule, trade.entry_time)
            opened_event(key, trade.entry_rule, trade.side, trade.entry_time, trade.entry_price, trade.quantity,
                         trade.stop_level, trade.take_level, trade.order_kind)
            follow_ups(
                key, trade.entry_rule,
                [{"time": item["time"], "price": item["price"], "quantity": item["quantity"], "pnl": item["pnl"]}
                 for item in trade.partials or []],
                [{"time": item["time"], "price": item["price"], "quantity": item["quantity"], "n": item["n"]}
                 for item in trade.adds or []],
                [{"time": item["time"], "level": item["level"]} for item in (trade.stop_moves or [])[1:]],
            )
            if key not in seen_closed:
                seen_closed.add(key)
                memory["closed"].append(key)
                events.append({
                    "time": trade.exit_time, "order": 6, "kind": "closed",
                    "data": {"key": key, "entry": trade.entry_rule, "side": trade.side, "reason": trade.exit_reason,
                             "exitRule": trade.exit_rule, "price": trade.exit_price, "pnl": trade.pnl,
                             "pnlPct": trade.pnl_pct, "fees": trade.fees},
                })

        for position in opened:
            entry_time = int(minutes.time[position.entry_minute])
            rule = position.rule + 1
            key = _key(rule, entry_time)
            opened_event(key, rule, self.entries[position.rule]["side"], entry_time, position.entry_price,
                         position.quantity, position.stop_level, position.take_level, position.order_kind)
            follow_ups(
                key, rule,
                [{"time": int(minutes.time[m]), "price": price, "quantity": position.quantity * fraction}
                 for m, price, fraction in position.partials],
                [{"time": int(minutes.time[item[0]]), "price": item[1], "quantity": item[2], "n": item[5] + 1}
                 for item in position.adds],
                [{"time": item["time"], "level": item["level"]} for item in (position.stop_moves or [])[1:]],
            )

    def _journal_events(self, events: list, live: dict, bars, minutes: Candles) -> None:
        memory = self.memory
        seen = set(memory["journal"])
        for item in live["journal"]:
            kind = item["kind"]
            if kind == "signal":
                time_ms = int(bars.time[item["bar"]])
                data = {"entry": item["rule"] + 1, "outcome": item["outcome"]}
                order = 2
            elif kind == "pause":
                time_ms = int(item["time"])
                data = {"guard": item["guard"], "until": int(item["until"])}
                order = 7
            else:
                time_ms = int(minutes.time[min(item["minute"], len(minutes) - 1)])
                data = {"entry": item["rule"] + 1, "event": kind, "price": item.get("price"), "reason": item.get("reason")}
                kind, order = "order", 2
            key = f"{kind}:{time_ms}:{data.get('entry', data.get('guard'))}:{data.get('event', '')}"
            if time_ms < memory["since"] or key in seen:
                continue
            seen.add(key)
            memory["journal"].append(key)
            events.append({"time": time_ms, "order": order, "kind": kind, "data": data})

    def _deposit_events(self, events: list, live: dict) -> None:
        done = self.memory["deposits"]
        for time_ms, amount in live["deposits"][done:]:
            events.append({"time": time_ms, "order": 1, "kind": "deposit", "data": {"amount": amount}})
        self.memory["deposits"] = max(done, len(live["deposits"]))

    def _setup_events(self, events: list, live: dict, bars) -> None:
        memory = self.memory
        seen = set(memory["setup"])
        first = live["first_bar"]
        for number, setup in enumerate(live["setup"], start=1):
            if not setup:
                continue
            # O "rearm" (cumpriu-se outra vez já armada) acontece em cada vela: fica de fora
            for name in ("arm", "expire", "cancel", "fire"):
                for item in setup[name]:
                    bar = item[0] if name == "fire" else item
                    if bar < first or bar >= len(bars):
                        continue
                    time_ms = int(bars.time[bar])
                    key = f"setup:{number}:{name}:{time_ms}"
                    if time_ms < memory["since"] or key in seen:
                        continue
                    seen.add(key)
                    memory["setup"].append(key)
                    events.append({"time": time_ms, "order": 1, "kind": "setup", "data": {"entry": number, "event": name}})

    def _condition_events(self, events: list, live: dict, bars) -> None:
        """As condições em cada vela de decisão nova: a primeira vez o estado de
        todas; depois só as que mudaram (e o conjunto de cada entrada a cumprir-se)."""
        memory = self.memory
        first = live["first_bar"]
        new = np.flatnonzero((bars.time > memory["lastBar"]) & (np.arange(len(bars)) >= first))
        if not len(new):
            return
        if len(new) > MAX_CONDITION_BARS:
            new = new[-1:]
        chart = live["chart"]
        values = {}
        for slot in self.slots:
            if slot.scope == "met":
                entry = self.entries[slot.entry - 1]
                values[slot.id] = entry_signal(chart, entry.get("conditions") or [], entry.get("match"))
            else:
                values[slot.id] = _condition(chart, slot.condition)
        previous = memory["conditions"]
        for bar in new.tolist():
            time_ms = int(bars.time[bar])
            now = {slot.id: bool(values[slot.id][bar]) for slot in self.slots}
            if not previous:
                events.append({"time": time_ms, "order": 0, "kind": "conditionsSnapshot", "data": {"values": now}})
            else:
                for slot in self.slots:
                    value = now[slot.id]
                    if previous.get(slot.id) == value:
                        continue
                    events.append({
                        "time": time_ms, "order": 1 if slot.scope == "met" else 0,
                        "kind": "conditionsMet" if slot.scope == "met" else "condition",
                        "data": {"id": slot.id, "scope": slot.scope, "entry": slot.entry, "exit": slot.exit,
                                 "path": slot.path, "group": slot.group, "value": value},
                    })
            previous = now
        memory["conditions"] = previous
        memory["lastBar"] = int(bars.time[new[-1]])
        self.state["conditionsBarTime"] = memory["lastBar"]

    def _prune(self, now_ms: int) -> None:
        """Os registos mais antigos do que MEMORY_DAYS saem da memória: daí para
        trás conta tudo como registado."""
        since = now_ms - MEMORY_DAYS * DAY_MS
        if since <= self.memory["since"] + DAY_MS:
            return
        self.memory["since"] = since

        def recent(key: str, position: int) -> bool:
            try:
                return int(key.split(":")[position]) >= since
            except (IndexError, ValueError):
                return True

        self.memory["journal"] = [key for key in self.memory["journal"] if recent(key, 1)]
        self.memory["setup"] = [key for key in self.memory["setup"] if recent(key, 3)]

    # --- o estado à vista --------------------------------------------------
    def _build_state(self, trades, opened, live, minutes: Candles, bars, summary) -> dict:
        price = float(self.current.close if self.current else minutes.close[-1])
        self.capital = float(live["capital"]) if live else float(summary.get("finalCapital", self.capital))
        self.open_math = []
        open_rows = []
        for position in opened:
            rule = position.rule + 1
            entry_time = int(minutes.time[position.entry_minute])
            key = _key(rule, entry_time)
            direction = position.direction
            # O que tem agora: a inicial, mais os reforços, menos as parciais
            bought = position.quantity + sum(item[2] for item in position.adds)
            cost = position.quantity * position.entry_price + sum(item[2] * item[1] for item in position.adds)
            average = cost / bought if bought else position.entry_price
            sold = sum(position.quantity * fraction for _, _, fraction in position.partials)
            partial_pnl = sum(
                direction * position.quantity * fraction * (part_price - average)
                - position.quantity * fraction * (average * self.fee_entry + part_price * self.fee_exit)
                for _, part_price, fraction in position.partials
            )
            held = max(bought - sold, 0.0)
            stop = position.stop_moves[-1]["level"] if position.stop_moves else position.stop_level
            math_row = {
                "key": key, "direction": direction, "held": held, "average": average, "partial": partial_pnl,
                "stop": stop, "take": position.take_level,
            }
            self.open_math.append(math_row)
            open_rows.append({
                "key": key,
                "entry": rule,
                "side": self.entries[position.rule]["side"],
                "entryTime": entry_time,
                "entryPrice": position.entry_price,
                "quantity": held,
                "average": average,
                "stop": stop,
                "take": position.take_level,
                "orderKind": position.order_kind,
                "partials": [{"time": int(minutes.time[m]), "price": p, "quantity": position.quantity * f} for m, p, f in position.partials],
                "adds": [{"time": int(minutes.time[item[0]]), "price": item[1], "quantity": item[2]} for item in position.adds],
                "stopMoves": position.stop_moves,
            })
        unrealized = self._unrealized(price)
        for row, value in zip(open_rows, unrealized["each"]):
            row["pnl"] = value
        setup_armed = []
        if live:
            last = len(bars) - 1
            for entry, setup in zip(self.entries, live["setup"]):
                if not setup:
                    setup_armed.append(None)
                    continue
                armed = max(setup["arm"] + setup["rearm"], default=-1)
                ended = max([item[0] for item in setup["fire"]] + setup["cancel"] + setup["expire"], default=-1)
                window = max(1, int((entry.get("setup") or {}).get("bars") or 1))
                setup_armed.append(armed > ended and last - armed <= window)
        deposited = sum(amount for _, amount in live["deposits"]) if live else 0.0
        return {
            "waitingFirstBar": False,
            "price": price,
            "priceTime": int(self.current.time if self.current else minutes.time[-1]),
            "capital": self.capital,
            "equity": self.capital + unrealized["total"],
            "unrealized": unrealized["total"],
            "realized": float(sum(trade.pnl for trade in trades)),
            "initialCapital": float(self.strategy["initialCapital"]),
            "deposited": deposited,
            "trades": [
                {
                    "key": _key(trade.entry_rule, trade.entry_time),
                    "entryRule": trade.entry_rule,
                    "side": trade.side,
                    "entryTime": trade.entry_time,
                    "entryPrice": trade.entry_price,
                    "exitTime": trade.exit_time,
                    "exitPrice": trade.exit_price,
                    "exitReason": trade.exit_reason,
                    "exitRule": trade.exit_rule,
                    "quantity": trade.quantity,
                    "pnl": trade.pnl,
                    "pnlPct": trade.pnl_pct,
                    "fees": trade.fees,
                    "partials": trade.partials,
                    "adds": trade.adds,
                    "stopMoves": trade.stop_moves,
                }
                for trade in sorted(trades, key=lambda item: item.entry_time)
            ],
            "open": open_rows,
            "pending": sorted({rule + 1 for rule in live["pending"]}) if live else [],
            "pausedUntil": int(live["pausedUntil"]) if live else 0,
            "conditions": self.memory["conditions"],
            "conditionsBarTime": self.memory["lastBar"] or None,
            "setupArmed": setup_armed,
        }

    def _unrealized(self, price: float) -> dict:
        each = []
        for row in self.open_math:
            held, average = row["held"], row["average"]
            value = (
                row["partial"]
                + row["direction"] * held * (price - average)
                - held * (average * self.fee_entry + price * self.fee_exit)
            )
            each.append(value)
        return {"each": each, "total": float(sum(each))}

    def tick(self) -> tuple[dict, list[dict]]:
        """O preço do minuto a decorrer: o P&L das posições abertas e os toques no
        stop e no take (registados uma vez; quem decide a saída é o motor, no fim
        do minuto)."""
        closes = self.closes
        price = self.current.close if self.current else (float(closes[-1]) if len(closes) else math.nan)
        unrealized = self._unrealized(price)
        touched = set(self.memory["touched"])
        events = []
        for row in self.open_math:
            long = row["direction"] == 1
            for what, level in (("stop", row["stop"]), ("take", row["take"])):
                if level is None:
                    continue
                hit = (price <= level if long else price >= level) if what == "stop" else (price >= level if long else price <= level)
                mark = f"{row['key']}:{what}"
                if hit and mark not in touched:
                    touched.add(mark)
                    self.memory["touched"].append(mark)
                    events.append({
                        "time": self.current.time if self.current else 0, "kind": "touch",
                        "data": {"key": row["key"], "entry": int(row["key"].split(":")[0]), "what": what, "level": level, "price": price},
                    })
        payload = {
            "price": price,
            "bar": None if self.current is None else {
                "time": self.current.time, "open": self.current.open, "high": self.current.high,
                "low": self.current.low, "close": self.current.close, "volume": self.current.volume,
            },
            "equity": self.capital + unrealized["total"],
            "unrealized": unrealized["total"],
            "positions": [{"key": row["key"], "pnl": value} for row, value in zip(self.open_math, unrealized["each"])],
        }
        return payload, events

    def close_if_quiet(self, now_ms: int, grace_ms: int) -> bool:
        """Na Coinbase um minuto sem negócios não tem vela: passado o minuto (e uma
        folga), o atual fecha na mesma e o motor corre outra vez sem esperar pelo
        próximo negócio. Devolve True se fechou."""
        if self.current is None or now_ms < self.current.time + MINUTE_MS + grace_ms:
            return False
        self._append(self.current)
        self.current = None
        return True

    # --- o motor noutro processo -------------------------------------------
    def engine_result(self) -> dict:
        """O que a corrida do motor muda no bot (volta do processo do motor)."""
        return {"memory": self.memory, "state": self.state, "capital": self.capital, "open_math": self.open_math}

    def apply_engine_result(self, result: dict) -> None:
        self.memory = result["memory"]
        self.state = result["state"]
        self.capital = result["capital"]
        self.open_math = result["open_math"]


def rerun_in_process(bot: LiveBot, now_ms: int, final: bool) -> tuple[list[dict], dict]:
    """O `rerun` num processo do conjunto do motor: o bot chega em pickle (com os
    minutos) e voltam os registos novos e o que mudou nele (`engine_result`)."""
    events = bot.rerun(now_ms, final)
    return events, bot.engine_result()

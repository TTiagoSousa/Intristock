"""Os ajustes do stop de uma entrada (`stopRules`): regras que, a partir de quando
acontecem — sempre, depois de o preço andar X R ou X % a favor, ou quando umas
condições se cumprem —, puxam o stop para o preço de entrada, para a mínima (numa
compra) ou a máxima (numa venda) das últimas N velas fechadas, para um nível ou
para um trailing em % do melhor preço. Vê-se na abertura de cada vela depois da
da entrada e o stop só aperta, nunca alarga."""

import numpy as np

from ..strategy import Chart, entry_signal, exit_level
from ..strategy.indicators import _shift, indicator

# O motivo de saída de cada destino
_REASONS = {"entry": "break_even", "trail": "trailing_stop", "swing": "stop_loss", "level": "stop_loss"}
# O código de um ajuste no `_find_stop`: a partir deste, o ajuste n.º código − RULE_KIND
# (0 o stop fixo, 1 trailing, 2 break-even e 3 stop movido são os da entrada)
RULE_KIND = 4


class StopRules:
    """As séries de cada ajuste (condições, mínimas, níveis), feitas uma vez por entrada."""

    def __init__(self, chart: Chart, entries: list[dict]):
        self.chart = chart
        self.rules = [
            [self._prepare(rule, index) for index, rule in enumerate(entry.get("stopRules") or [])]
            for entry in entries
        ]

    def _prepare(self, rule: dict, index: int) -> dict:
        chart = self.chart
        prepared = {
            "trigger": rule.get("trigger") or "always",
            "to": rule.get("to") or "entry",
            "r": float(rule.get("r") or 0),
            "pct": float(rule.get("pct") or 0) / 100,
            "trail": float(rule.get("trailPct") or 0) / 100,
            "buffer": float(rule.get("bufferPct") or 0) / 100,
            "kind": RULE_KIND + index,
            "reason": _REASONS.get(rule.get("to") or "entry", "stop_loss"),
        }
        if prepared["trigger"] == "conditions":
            prepared["active"] = entry_signal(chart, rule.get("conditions") or [], rule.get("match"))
        if prepared["to"] == "swing":
            bars = max(1, int(rule.get("bars") or 1))
            # Das N velas fechadas antes de cada vela (a mínima para as compras, a máxima para as vendas)
            prepared["low"] = _shift(indicator("lowest", chart.bars.low, bars), 1)
            prepared["high"] = _shift(indicator("highest", chart.bars.high, bars), 1)
        if prepared["to"] == "level" and rule.get("level"):
            prepared["level"] = exit_level(chart, rule["level"])
        return prepared

    def path(self, rule: int, direction: int, entry_bar: int, entry_minute: int, raw_entry: float, stop):
        """O stop movido desta posição, minuto a minuto (para o `_find_stop`), ou None sem ajustes."""
        if not self.rules[rule]:
            return None
        return _Path(self.chart, self.rules[rule], direction, entry_bar, entry_minute, raw_entry, stop)


class _Path:
    """O stop de uma posição vela a vela, feito aos bocados à medida que a procura avança."""

    def __init__(self, chart: Chart, rules: list[dict], direction: int, entry_bar: int, entry_minute: int,
                 raw_entry: float, stop):
        self.bars = chart.bars
        self.minutes = chart.minutes
        self.rules = rules
        self.direction = direction
        self.long = direction == 1
        self.entry_bar = entry_bar
        self.raw_entry = raw_entry
        self.risk = abs(raw_entry - stop) if stop is not None else None
        self.nothing = -np.inf if self.long else np.inf
        # O estado entre bocados: a próxima vela, o melhor preço até à abertura dela,
        # que ajustes já aconteceram e o stop e o motivo até ali
        self.next = entry_bar + 1
        first = int(self.bars.first_minute[self.next]) if self.next < len(self.bars) else len(self.minutes)
        span = slice(entry_minute, max(first, entry_minute + 1))
        extreme = self.minutes.high[span].max() if self.long else self.minutes.low[span].min()
        self.best = max(raw_entry, float(extreme)) if self.long else min(raw_entry, float(extreme))
        self.latched = [False] * len(rules)
        # A vela em que cada ajuste aconteceu (None: ainda não)
        self.fired: list[int | None] = [None] * len(rules)
        self.reasons = [rule["reason"] for rule in rules]
        self.stop = self.nothing
        self.kind = 3
        self.levels = np.empty(0)
        self.kinds = np.empty(0, np.int8)

    def _extend(self, until: int) -> None:
        """Faz as velas de `self.next` até `until` (exclusivo)."""
        a, b = self.next, min(until, len(self.bars))
        if b <= a:
            return
        bars, long, direction = self.bars, self.long, self.direction
        extremes = bars.high[a : b - 1] if long else bars.low[a : b - 1]
        accumulate = np.maximum.accumulate if long else np.minimum.accumulate
        best = accumulate(np.r_[self.best, extremes])  # o melhor preço até à abertura de cada vela
        last = float(bars.high[b - 1] if long else bars.low[b - 1])
        self.best = max(float(best[-1]), last) if long else min(float(best[-1]), last)

        size = b - a
        combined = np.full(size, self.nothing)
        combined_kind = np.full(size, 3, np.int8)
        for index, rule in enumerate(self.rules):
            trigger = rule["trigger"]
            if trigger == "profit":
                if rule["r"]:
                    if self.risk is None:
                        continue
                    threshold = rule["r"] * self.risk
                else:
                    threshold = rule["pct"] * self.raw_entry
                hit = direction * (best - self.raw_entry) >= threshold
            elif trigger == "conditions":
                hit = rule["active"][a:b]
            else:
                hit = np.ones(size, bool)
            on = np.logical_or.accumulate(np.r_[self.latched[index], hit])[1:]
            self.latched[index] = bool(on[-1])
            if self.fired[index] is None and on[-1]:
                self.fired[index] = a + int(np.argmax(on))

            to = rule["to"]
            if to == "entry":
                level = np.full(size, self.raw_entry)
            elif to == "trail":
                level = best * (1 - direction * rule["trail"])
            elif to == "swing":
                level = (rule["low"] if long else rule["high"])[a:b] * (1 - direction * rule["buffer"])
            elif "level" in rule:
                level = rule["level"][a:b] * (1 - direction * rule["buffer"])
            else:
                continue
            level = np.where(on & ~np.isnan(level), level, self.nothing)
            better = level > combined if long else level < combined
            combined = np.where(better, level, combined)
            combined_kind = np.where(better, rule["kind"], combined_kind)

        # O stop só aperta: o melhor até cada vela, com o motivo de quem o pôs lá
        steps = accumulate(np.r_[self.stop, combined])[1:]
        before = np.r_[self.stop, steps[:-1]]
        moved = steps > before if long else steps < before
        kinds = np.where(moved, combined_kind, -1)
        kinds = np.where(kinds >= 0, kinds, 0)
        # O motivo segue o último ajuste que moveu o stop
        last_move = np.maximum.accumulate(np.where(moved, np.arange(size), -1))
        filled = np.where(last_move >= 0, kinds[np.maximum(last_move, 0)], self.kind).astype(np.int8)
        self.stop = float(steps[-1])
        self.kind = int(filled[-1])
        self.levels = np.r_[self.levels, steps]
        self.kinds = np.r_[self.kinds, filled].astype(np.int8)
        self.next = b

    def fired_until(self, bar: int) -> list[int]:
        """Os ajustes (1, 2…) que aconteceram até à vela `bar`, inclusive."""
        self._extend(bar + 1)
        return [index + 1 for index, at in enumerate(self.fired) if at is not None and at <= bar]

    def levels_until(self, bar: int) -> tuple[np.ndarray, np.ndarray]:
        """As velas da seguinte à da entrada até `bar` e o stop dos ajustes em cada uma."""
        self._extend(bar + 1)
        count = max(0, min(bar - self.entry_bar, len(self.levels)))
        return np.arange(self.entry_bar + 1, self.entry_bar + 1 + count), self.levels[:count]

    def __call__(self, start: int, end: int):
        """O stop movido em cada minuto de `start` a `end` (exclusivo); antes da vela
        seguinte à da entrada, nenhum."""
        first_minute = self.bars.first_minute
        minutes = np.arange(start, end)
        bar = np.searchsorted(first_minute, minutes, side="right") - 1
        if len(bar):
            self._extend(int(bar[-1]) + 1)
        offset = bar - (self.entry_bar + 1)
        valid = (offset >= 0) & (offset < len(self.levels))
        levels = np.full(len(minutes), self.nothing)
        kinds = np.full(len(minutes), 3, np.int8)
        levels[valid] = self.levels[offset[valid]]
        kinds[valid] = self.kinds[offset[valid]]
        return levels, kinds

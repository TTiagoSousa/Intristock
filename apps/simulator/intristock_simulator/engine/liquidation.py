"""A liquidação dos futuros.

Vê-se à parte da saída planeada, que só pode cortar: entre duas mudanças (uma
posição que abre ou fecha, um reforço, uma parcial, um depósito) o preço de
liquidação é fixo, e procura-se minuto a minuto até à mudança seguinte. Na
isolada cada posição tem o seu (a margem do que tem, ao preço médio); na
cruzada é um só para a conta: o capital, o lucro já realizado nas parciais e
o flutuante de todas as posições contra a manutenção de todas, por isso o
capital não conta duas vezes e as perdas de uma tiram margem às outras.
"""

import numpy as np

from .constants import LIQUIDATE, RECHECK
from .execution import SEARCH_WINDOW
from .models import Position


class LiquidationMixin:
    """A vigia da liquidação (métodos da simulação; o estado está no `Prepared`)."""

    def holding(self, position: Position, until: int) -> tuple[float, float, float]:
        """A quantidade, o custo e o lucro realizado (sem comissões) da posição no
        minuto `until`: os reforços que já entraram e as parciais até lá."""
        if not position.adds and not (position.partials and position.partials[0][0] <= until):
            return position.quantity, position.quantity * position.entry_price, 0.0
        changes = [(add[0], 0, add[1], add[2]) for add in position.adds]
        changes += [(m, 1, price, position.quantity * fraction) for m, price, fraction in position.partials if m <= until]
        changes.sort(key=lambda item: (item[0], item[1]))
        held, cost, realized = position.quantity, position.quantity * position.entry_price, 0.0
        for _, kind, price, quantity in changes:
            if kind == 0:
                held, cost = held + quantity, cost + quantity * price
                continue
            average = cost / held
            quantity = min(quantity, held)
            realized += position.direction * quantity * (price - average)
            held, cost = held - quantity, cost - quantity * average
        return held, cost, realized

    def watched(self, key: Position | None) -> list[Position]:
        """As posições de uma vigia: a própria (isolada) ou todas as com alavancagem (cruzada)."""
        if key is not None:
            return [] if key.closed else [key]
        return [item for item in self.open_positions if self.leverages[item.rule] is not None]

    def liquidation_level(self, members: list[Position], now: int) -> tuple[float, bool] | None:
        """O preço de liquidação agora e se se chega lá a descer (True) ou a subir; None se não há."""
        leverages, maintenance = self.leverages, self.maintenance
        if self.cross:
            self.take_deposits(int(self.minutes.time[now]))
            # As posições sem alavancagem só prendem a margem delas
            equity = self.capital - sum(
                item.margin + sum(add[3] for add in item.adds)
                for item in self.open_positions if leverages[item.rule] is None
            )
            net = signed = kept = 0.0
            for item in members:
                held, cost, realized = self.holding(item, now)
                equity += realized
                net += item.direction * held
                signed += item.direction * cost
                kept += cost * maintenance
            # capital + realizado + Σ direção × quantidade × (P − médio) = manutenção
            if abs(net) < 1e-12:
                return None
            level = (kept - equity + signed) / net
            falling = net > 0
        else:
            item = members[0]
            held, cost, _ = self.holding(item, now)
            if held <= 0:
                return None
            # A margem do que tem (o custo ÷ a alavancagem) menos a manutenção
            level = cost / held * (1 - item.direction * (1 / float(leverages[item.rule]) - maintenance))
            falling = item.direction == 1
        return (level, falling) if level > 0 else None

    def next_change(self, members: list[Position], now: int) -> int:
        """O minuto da próxima mudança das posições da vigia: a saída planeada de uma,
        um reforço e, na cruzada, uma parcial ou um depósito."""
        cross = self.cross
        changes = []
        for item in members:
            changes.append(item.exit_minute)
            if item.adds_done < len(item.planned_adds):
                changes.append(item.planned_adds[item.adds_done][0])
            if cross:
                changes += [m for m, _, _ in item.partials if m > now][:1]
        if cross and self.paid < len(self.deposits):
            deposit = int(np.searchsorted(self.minutes.time, self.deposits[self.paid], side="left"))
            if now < deposit < len(self.minutes):
                changes.append(deposit)
        return min(changes)

    def first_cross(self, start: int, end: int, level: float, falling: bool) -> int | None:
        """O primeiro minuto de `start` a `end` (inclusive) em que o preço chega ao nível."""
        minutes = self.minutes
        window = SEARCH_WINDOW
        while start <= end:
            stop = min(start + window, end + 1)
            reached = minutes.low[start:stop] <= level if falling else minutes.high[start:stop] >= level
            hits = np.flatnonzero(reached)
            if len(hits):
                return start + int(hits[0])
            start = stop
            window *= 2
        return None

    def watch(self, key: Position | None, now: int, again: bool = True) -> None:
        """Vigia a liquidação a partir do minuto `now` (`key`: a posição, na isolada;
        None, a conta, na cruzada). As vigias antigas desta chave deixam de contar.
        Com uma mudança ainda por ver neste minuto (um reforço, uma saída), volta-se
        a ver no fim dele (`again`; a vigia que já é isso não volta)."""
        if key is None:
            self.cross_watch += 1
            generation = self.cross_watch
        else:
            key.watch += 1
            generation = key.watch
        members = self.watched(key)
        if not members:
            return
        found = self.liquidation_level(members, now)
        boundary = self.next_change(members, now)
        if found is not None:
            minute = self.first_cross(now, boundary, *found)
            if minute is not None:
                self.push(minute, LIQUIDATE, (key, generation, found[0]))
                return
        # (na isolada, a saída da própria posição já é o fim da vigia)
        if (boundary > now or again) and (key is None or boundary < key.exit_minute):
            self.push(boundary, RECHECK, (key, generation))

    def watching(self, key: Position | None, generation: int) -> bool:
        """Se a vigia ainda é a atual (uma mudança depois dela fez outra)."""
        return generation == (self.cross_watch if key is None else key.watch)

    def liquidate(self, key: Position | None, minute: int, level: float) -> None:
        """O preço chegou à liquidação neste minuto. Uma posição cujo stop bate nele
        antes de o preço lá chegar sai pelo stop (como no `_find_stop`); as outras
        fecham ao preço da liquidação. Na cruzada, sem as que saíram, vê-se outra vez."""
        cross = self.cross
        members = self.watched(key)
        for item in members:
            if (
                item.exit_minute == minute
                and item.exit_reason in ("stop_loss", "trailing_stop", "break_even")
                and item.direction * (item.raw_exit - level) > 0
            ):
                self.close_position(item)
        rest = [item for item in members if not item.closed]
        if cross and len(rest) < len(members):
            found = self.liquidation_level(rest, minute) if rest else None
            if found is None or self.first_cross(minute, minute, *found) is None:
                self.watch(key, minute)
                return
            level = found[0]
        for item in rest:
            item.exit_minute, item.raw_exit, item.exit_reason = minute, level, "liquidation"
            item.exit_rule, item.exit_slipped = None, False
            item.partials = [part for part in item.partials if part[0] < minute]
            if item.path is not None:
                item.stop_rules_fired = item.path.fired_until(self.bar_of(minute))
            if not self.lite or self.live is not None:
                item.stop_moves = self.stop_history(item, item.path, item.moved_at)
            self.close_position(item)
        if cross:
            self.watch(None, minute)

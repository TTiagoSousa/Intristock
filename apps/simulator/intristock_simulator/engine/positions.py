"""Abrir, reforçar e fechar posições: o tamanho, os depósitos que entram, o
funding, o P&L de cada trade e as regras que reagem a ele (tamanho, regras
gerais, limites do dia, pausa depois de uma saída)."""

import math

import numpy as np

from .clock import _duration
from .constants import ADD, EXIT, STOP_REASONS
from .execution import _slipped
from .models import Position, Trade


class PositionsMixin:
    """As posições (métodos da simulação; o estado está no `Prepared`)."""

    def take_deposits(self, time_ms: int) -> None:
        due = int(np.searchsorted(self.deposits, time_ms, side="right"))
        if due > self.paid:
            added = float(self.deposit_amounts[self.paid:due].sum())
            self.capital += added
            self.contributed += added
            self.paid = due

    def can_hold(self, rule: int) -> bool:
        direction = self.directions[rule]
        if self.open_by_direction[-direction] and self.opposite != "hedge":
            return False
        return self.open_total < self.max_positions and self.open_by_rule[rule] < self.rule_limit[rule]

    def open_position(self, rule: int, bar: int, minute: int, raw_entry: float, rising) -> None:
        minutes = self.minutes
        self.take_deposits(int(minutes.time[minute]))
        direction = self.directions[rule]
        buying = direction == 1
        entry_price = self.slip(raw_entry, buying) if _slipped(rising, buying) else raw_entry
        free = self.capital - self.margin_used
        funnel = self.funnel
        if free <= 0 or entry_price <= 0:
            self.skipped += 1
            funnel["noCapital"] += 1
            return False
        # O stop vê as velas fechadas antes da vela em que entra
        stop = self.initial_stop(rule, self.bar_of(minute), raw_entry, direction)
        if stop is not None and math.isnan(stop):
            self.skipped += 1
            funnel["invalidStop"] += 1
            return False
        target = self.target_of(rule, raw_entry, direction, stop)
        risk = abs(raw_entry - stop) / raw_entry if stop is not None else 0.0

        capital = self.capital
        base = capital if self.compound else min(self.contributed, capital)
        sizing_mode, value = self.sizings[rule]
        sizing_adjust = self.sizing_adjust
        if sizing_adjust and sizing_adjust[0] == "set":
            value = sizing_adjust[1]
        elif sizing_adjust:
            value *= sizing_adjust[1]
        leverage = float(self.leverages[rule] or 1)
        if sizing_mode == "risk":
            if not risk:
                self.skipped += 1
                funnel["rejectedMinimum"] += 1
                return False
            quantity = base * value / 100 / (raw_entry * risk)
            margin = quantity * entry_price / leverage
        elif sizing_mode == "amount":
            margin = value
            quantity = margin * leverage / entry_price
        else:
            margin = base * value / 100
            quantity = margin * leverage / entry_price
        if margin > free:
            margin = free
            quantity = margin * leverage / entry_price
        step = self.step
        if step:
            quantity = math.floor(quantity / step + 1e-9) * step
            margin = quantity * entry_price / leverage
        if quantity <= 0 or quantity < self.min_quantity or quantity * entry_price < self.min_notional:
            self.skipped += 1
            funnel["rejectedMinimum"] += 1
            return False

        # As próximas X entradas com o valor ajustado; depois volta ao normal
        if self.sizing_left:
            self.sizing_left -= 1
            if not self.sizing_left:
                self.sizing_adjust = None

        path = self.stop_rules.path(rule, direction, bar, minute, raw_entry, stop)
        plan = self.plan_exit(rule, direction, bar, minute, raw_entry, stop, target, path=path)
        plan, partials, moved = self.plan_partials(
            rule, direction, bar, minute, raw_entry, stop, target, plan, path, quantity
        )
        plan, partials, adds, moved_at = self.plan_adds(
            rule, direction, bar, minute, raw_entry, stop, target, plan, path, partials, moved
        )
        exit_minute, raw_exit, reason, exit_rule, exit_slipped = plan
        position = Position(
            rule, direction, bar, minute, raw_entry, entry_price, quantity, margin,
            exit_minute, raw_exit, reason, exit_rule, exit_slipped,
            stop_level=stop, take_level=target, partials=partials, planned_adds=adds, path=path, moved_at=moved_at,
        )
        if path is not None:
            position.stop_rules_fired = path.fired_until(self.bar_of(exit_minute))
        if not self.lite or self.live is not None:
            position.stop_moves = self.stop_history(position, path, moved_at)
        for add in adds:
            self.add_stats[rule][add[3]]["reached"] += 1
        # Ao mercado, num nível a favor do preço (limite) ou a romper (stop)
        if rising is not None:
            position.order_kind = "stop" if _slipped(rising, buying) else "limit"
            position.wait_bars = self.bar_of(minute) - bar
            if position.order_kind == "limit":
                position.slippage_saved = quantity * raw_entry * self.slippage
        self.margin_used += margin
        self.open_total += 1
        self.open_by_direction[direction] += 1
        self.open_by_rule[rule] += 1
        self.most_open = max(self.most_open, self.open_total)
        self.account.opened_trade(rule, int(minutes.time[minute]))
        self.open_positions.append(position)
        self.push(exit_minute, EXIT, position)
        for add in adds:
            self.push(add[0], ADD, (position, add))
        if self.leverages[rule] is not None:
            self.watch(None if self.cross else position, minute)
        return True

    def add_to(self, position: Position, planned) -> None:
        """Um reforço chegou ao minuto dele: junta a fração da quantidade inicial ao
        preço com slippage (é uma ordem stop ou a mercado), até ao capital livre."""
        add_minute, raw_price, fraction, index = planned
        position.adds_done += 1
        if position.closed or add_minute >= position.exit_minute:
            # Liquidada antes (ou no mesmo minuto): o preço já não chegou ao reforço
            self.add_stats[position.rule][index]["reached"] -= 1
            return
        self.take_deposits(int(self.minutes.time[add_minute]))
        price = self.slip(raw_price, position.direction == 1)
        leverage = float(self.leverages[position.rule] or 1)
        quantity = position.quantity * fraction
        free = self.capital - self.margin_used
        stats = self.add_stats[position.rule][index]
        reduced = quantity * price / leverage > free
        if reduced:
            quantity = max(free, 0.0) * leverage / price
        step = self.step
        if step:
            quantity = math.floor(quantity / step + 1e-9) * step
        if quantity <= 0 or quantity < self.min_quantity or quantity * price < self.min_notional:
            # 4.9 sem capital livre (ou abaixo do mínimo da corretora) não entra
            stats["noCapital" if reduced else "rejectedMinimum"] += 1
            return
        stats["filled"] += 1
        stats["reduced"] += reduced
        margin = quantity * price / leverage
        self.margin_used += margin
        position.adds.append((add_minute, price, quantity, margin, raw_price, index))

    def funding_between(self, start_time: int, end_time: int, direction: int, quantity: float) -> float:
        """O funding das horas de funding entre dois instantes ]início, fim], com esta
        quantidade. Uma hora de funding T paga-se com a posição aberta em T: os tempos
        são o início do minuto e o que acontece nele (entrar, sair, mudar a quantidade)
        já é depois de T. Por isso quem entra no minuto T não paga o T e quem sai nele
        paga (a corretora vê a posição no instante T, antes da ordem)."""
        funding_times = self.funding_times
        first = int(np.searchsorted(funding_times, start_time, side="right"))
        last = int(np.searchsorted(funding_times, end_time, side="right"))
        if last <= first:
            return 0.0
        prices = self.minutes.open[self.funding_minutes[first:last]]
        return float(direction * quantity * np.sum(prices * self.funding_rates[first:last]))

    def close_position(self, position: Position) -> None:
        minutes, fee_entry, fee_exit = self.minutes, self.fee_entry, self.fee_exit
        direction = position.direction
        exit_price = self.slip(position.raw_exit, direction == -1) if position.exit_slipped else position.raw_exit
        entry_time = int(minutes.time[position.entry_minute])
        exit_time = int(minutes.time[position.exit_minute])

        # Os reforços (entram com slippage) e as saídas parciais (a um nível, sem
        # slippage), por ordem de tempo; o que fica sai na final. Cada saída conta ao
        # preço médio de entrada desse momento (vender não o muda; juntar sim)
        changes = [(int(minutes.time[add[0]]), 0, add[1], add[2], add[5]) for add in position.adds]
        changes += [
            (int(minutes.time[m]), 1, price, position.quantity * fraction, None) for m, price, fraction in position.partials
        ]
        changes.sort(key=lambda item: (item[0], item[1]))
        held, cost = position.quantity, position.quantity * position.entry_price
        partials, adds, partial_pnl, partial_fees = [], [], 0.0, 0.0
        funding_paid, since = 0.0, entry_time
        for change_time, kind, price, quantity, number in changes:
            funding_paid += self.funding_between(since, change_time, direction, held)
            since = change_time
            if kind == 0:
                held, cost = held + quantity, cost + quantity * price
                adds.append({"time": change_time, "price": price, "quantity": quantity, "n": number + 1})
                continue
            average = cost / held
            quantity = min(quantity, held)
            part_fees = quantity * (average * fee_entry + price * fee_exit)
            part_pnl = direction * quantity * (price - average) - part_fees
            held, cost = held - quantity, cost - quantity * average
            partial_pnl += part_pnl
            partial_fees += part_fees
            partials.append({"time": change_time, "price": price, "quantity": quantity, "pnl": part_pnl})
        remaining = held
        average = cost / held if held else position.entry_price
        # Funding de cada hora de funding com a posição aberta
        funding_paid += self.funding_between(since, exit_time, direction, remaining)

        if position.exit_reason == "liquidation":
            # Perde-se o movimento até ao preço da liquidação e a margem de manutenção
            # (sem comissão de saída): na isolada é a margem do que resta; na cruzada,
            # todas juntas levam o capital
            fees = remaining * average * fee_entry + partial_fees
            pnl = (
                partial_pnl
                + direction * remaining * (position.raw_exit - average)
                - remaining * average * (self.maintenance + fee_entry)
                - funding_paid
            )
        else:
            fees = remaining * (average * fee_entry + exit_price * fee_exit) + partial_fees
            pnl = (
                partial_pnl
                + direction * remaining * (exit_price - average)
                - remaining * (average * fee_entry + exit_price * fee_exit)
                - funding_paid
            )
        capital_before = self.capital
        pnl = max(pnl, -capital_before)  # não se perde mais do que se tem
        self.capital = capital_before + pnl
        margin = position.margin + sum(add[3] for add in position.adds)
        self.margin_used = max(self.margin_used - margin, 0.0)
        position.closed = True
        self.open_positions[:] = [item for item in self.open_positions if item is not position]
        self.open_total -= 1
        self.open_by_direction[direction] -= 1
        self.open_by_rule[position.rule] -= 1

        slippage_cost = (
            position.quantity * abs(position.entry_price - position.raw_entry)
            + sum(add[2] * abs(add[1] - add[4]) for add in position.adds)
            + remaining * abs(exit_price - position.raw_exit)
        )
        # Os depósitos que chegaram durante o trade
        self.take_deposits(exit_time)

        self.trades.append(
            Trade(
                entry_rule=position.rule + 1,
                side=self.entries[position.rule]["side"],
                entry_time=entry_time,
                entry_price=position.entry_price,
                exit_time=exit_time,
                exit_price=float(exit_price),
                exit_reason=position.exit_reason,
                exit_rule=position.exit_rule,
                quantity=position.quantity,
                pnl=pnl,
                pnl_pct=pnl / margin * 100 if margin else 0.0,
                fees=fees,
                equity=self.capital,
                funding=funding_paid,
                capital_return=pnl / capital_before if capital_before > 0 else 0.0,
                slippage=slippage_cost,
                margin=margin,
                order_kind=position.order_kind,
                wait_bars=position.wait_bars,
                slippage_saved=position.slippage_saved,
                raw_entry=position.raw_entry,
                stop_level=position.stop_level,
                take_level=position.take_level,
                stop_pct=abs(position.raw_entry - position.stop_level) / position.raw_entry * 100
                if position.stop_level is not None
                else None,
                partials=partials or None,
                adds=adds or None,
                stop_rules_fired=position.stop_rules_fired,
                stop_moves=position.stop_moves,
            )
        )
        self.account.closed_trade(position.rule, pnl, self.capital, exit_time)

        won = pnl > 0
        self.streak_wins, self.streak_losses = (self.streak_wins + 1, 0) if won else (0, self.streak_losses + 1)
        for rule in self.sizing_rules:
            streak = self.streak_losses if rule.get("after") == "losses" else self.streak_wins
            if streak != int(rule.get("count") or 0):
                continue
            action = rule.get("action")
            if action == "set":
                self.sizing_adjust = ("set", float(rule.get("value") or 0))
            elif action == "multiply":
                factor = float(rule.get("value") or 1)
                sizing_adjust = self.sizing_adjust
                self.sizing_adjust = (
                    (sizing_adjust[0], sizing_adjust[1] * factor) if sizing_adjust else ("multiply", factor)
                )
            else:
                self.sizing_adjust = None
            self.sizing_left = int(rule.get("trades") or 0) if action != "reset" else 0

        # As regras gerais: se uma se cumprir, pára as entradas durante a pausa
        history = self.history
        history.append((exit_time, pnl, position.exit_reason, capital_before))
        for guard_index, guard in enumerate(self.guards):
            window = _duration(guard.get("window"))
            recent = [item for item in history if item[0] > exit_time - window] if window else history
            event, limit = guard.get("event"), float(guard.get("value") or 0)
            if not recent or not limit:
                continue
            loss = -sum(item[1] for item in recent)
            if event == "stops":
                hit = sum(1 for item in recent if item[2] in STOP_REASONS) >= limit
            elif event == "losses":
                hit = sum(1 for item in recent if item[1] <= 0) >= limit
            elif event == "lossStreak":
                hit = self.streak_losses >= limit
            elif event == "lossAmount":
                hit = loss >= limit
            else:
                start_capital = recent[0][3]
                hit = start_capital > 0 and loss / start_capital * 100 >= limit
            if hit:
                until = max(self.paused_until, exit_time + _duration(guard.get("pause")))
                if self.journal is not None and until > self.paused_until:
                    self.journal.append({"kind": "pause", "time": exit_time, "until": until, "guard": guard_index + 1})
                self.paused_until = until

        day = self.clock.day(exit_time)
        if day != self.day_key:
            self.day_key, self.day_losses, self.day_pnl, self.day_capital = day, 0, 0.0, capital_before
        self.day_pnl += pnl
        self.day_losses = 0 if won else self.day_losses + 1

        exit_bar = self.bar_of(position.exit_minute)
        if position.exit_reason == "opposite":
            # A entrada que deu o sinal pode virar a posição já nesta vela
            self.closed_by_opposite[-direction] = exit_bar
        else:
            extra = self.cooldown if self.cooldown_any or not won else 0
            self.next_allowed_bar = max(self.next_allowed_bar, exit_bar + 1 + extra)

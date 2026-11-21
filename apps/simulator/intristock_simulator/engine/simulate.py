"""O ciclo da simulação: sinais, ordens, posições e saídas, por ordem de tempo.

A simulação é uma classe (`Simulation`) partida por zonas, cada uma no seu
módulo: o que se prepara antes do ciclo e o estado da conta (`prepare`), os
planos de saída de cada posição (`planning`), abrir, reforçar e fechar posições
(`positions`), a liquidação dos futuros (`liquidation`) e, aqui, as ordens de
cada sinal, o ciclo dos acontecimentos e o fim (o resumo e o relatório)."""

import heapq
import math
import time
from collections.abc import Callable

import numpy as np

from .. import factsheet
from ..market.candles import Bars, Candles
from .clock import _in_periods
from .constants import ADD, EXIT, EXPIRE, FILL, LIQUIDATE, RECHECK
from .execution import _touch
from .liquidation import LiquidationMixin
from .models import Trade
from . import progress
from .planning import PlanningMixin
from .positions import PositionsMixin
from .prepare import Prepared
from .progress import MAIN_SHARE, ReportProgress, _variants_expected
from .summary import _in_base, summarize


def run(
    bars: Bars,
    minutes: Candles,
    strategy: dict,
    start_ms: int,
    on_progress: Callable[[float], None],
    timeframe: str | None = None,
    funding=None,
    lite: bool = False,
    live: dict | None = None,
) -> tuple[list[Trade], dict, dict]:
    """Corre a simulação: os trades (pela ordem de entrada), o resumo (`result`)
    e o relatório (um bloco por coluna, `factsheet.REPORT_COLUMNS`). `lite` (as
    variantes da 2.3) não faz o relatório: só as contas das ordens.

    `live` (o teste ao vivo, com `lite`): as velas acabam agora, por isso as
    posições que chegam ao fim delas ficam abertas (não fecham como `end`) e as
    ordens ainda válidas ficam à espera. Enche o dicionário com o que o teste ao
    vivo mostra: `open` (as posições abertas), `pending` (as entradas com uma
    ordem à espera), `journal` (cada sinal e o que lhe aconteceu, as ordens
    executadas e caídas, as pausas), `deposits` (os depósitos que já entraram),
    `capital`, `marginUsed`, `pausedUntil`, `setup` (os acontecimentos da
    preparação de cada entrada), o `chart` e a `first_bar`."""
    simulation = Simulation(bars, minutes, strategy, start_ms, on_progress, timeframe, funding, lite, live)
    simulation.loop()
    return simulation.finish()


class Simulation(PlanningMixin, PositionsMixin, LiquidationMixin, Prepared):
    """Uma corrida do motor: o `Prepared` faz as séries e o estado; os mixins são as zonas do ciclo."""

    def outcome(self, before: dict) -> str:
        """O primeiro motivo do funil que mudou desde `before` (sem nenhum, entrou)."""
        for key, value in self.funnel.items():
            if key != "signals" and value != before[key]:
                return key
        return "entered"

    def push(self, minute: int, kind: int, payload) -> None:
        self.sequence += 1
        heapq.heappush(self.events, (minute, kind, self.sequence, payload))

    def blocked_today(self, bar: int) -> bool:
        # Sem limites do dia não há que saber o dia (é a cada sinal)
        if self.day_key is None or not (self.max_day_losses or self.max_day_loss):
            return False
        if self.clock.day(int(self.bars.time[bar])) != self.day_key:
            return False
        if self.max_day_losses and self.day_losses >= self.max_day_losses:
            return True
        return bool(self.max_day_loss and self.day_pnl <= -self.day_capital * self.max_day_loss)

    def place(self, bar: int, rule: int) -> None:
        """Uma entrada deu sinal na vela `bar`: põe a ordem, se puder."""
        bars, funnel = self.bars, self.funnel
        direction = self.directions[rule]
        funnel["signals"] += 1
        self.signals_by_rule[rule] += 1
        if bar < self.next_allowed_bar:
            funnel["blockedCooldown"] += 1
            return
        entry_allowed = self.entry_allowed[rule]
        if self.blocked[bar] or (entry_allowed is not None and not entry_allowed[bar]):
            funnel["blockedSchedule"] += 1
            return
        if bar <= self.pending_until[rule]:
            funnel["blockedPyramid"] += 1
            return
        if self.blocked_today(bar):
            funnel["blockedDaily"] += 1
            return
        if bars.time[bar] < self.paused_until:
            funnel["blockedGuards"] += 1
            return
        stopped_by = self.account.blocking(rule, int(bars.time[bar]), self.open_total, self.open_by_rule)
        if stopped_by is not None:
            funnel["blockedContext"] += 1
            self.context_blocks[rule][stopped_by] += 1
            return
        opposite = self.opposite
        if opposite == "close" and self.closed_by_opposite[direction] == bar:
            funnel["blockedOpposite"] += 1
            return
        order = self.entry_orders[rule]
        # Com uma posição contrária: num nível, ao fechar/virar, ela pode sair no
        # minuto em que a ordem entra (vê-se nesse minuto)
        if self.open_by_direction[-direction] and opposite != "hedge":
            if order.market or opposite == "ignore":
                funnel["blockedOpposite"] += 1
                return
        if self.open_by_rule[rule] + self.pending_by_rule[rule] >= self.rule_limit[rule]:
            funnel["blockedPyramid"] += 1
            return
        if self.open_total + sum(self.pending_by_rule) >= self.max_positions:
            funnel["blockedMaxPositions"] += 1
            return
        self.take_deposits(int(bars.time[bar]))
        if self.capital - self.margin_used <= 0:
            funnel["noCapital"] += 1
            return

        if order.market:
            minute = int(bars.first_minute[bar])
            self.open_position(rule, bar, minute, float(self.market[bar]), None)
            return

        # Uma ordem a um nível: procura-se a vela em que o preço lá chega
        minutes = self.minutes
        last_bar = min(bar + self.validity[rule], len(bars)) - 1
        fill = None
        level = float(order.level[bar])
        rising = not math.isnan(level) and level >= bars.open[bar]
        entry = self.entries[rule]
        cancelled = False
        for current in range(bar, last_bar + 1):
            if current > bar and entry.get("orderCancel") and not order.active[current]:
                last_bar = current - 1
                cancelled = True
                break
            if entry.get("orderTrack") and current > bar:
                level = float(order.level[current])
                rising = level >= bars.open[current]
            if math.isnan(level):
                continue
            fill = _touch(bars, minutes, current, level, rising, allowed=self.fill_masks[rule])
            if fill:
                last_bar = current
                break

        funnel["ordersPlaced"] += 1
        self.order_stats["placed"][rule] += 1
        self.pending_by_rule[rule] += 1
        self.pending_until[rule] = last_bar
        if fill:
            self.push(fill[0], FILL, (rule, bar, fill))
        else:
            expires = int(bars.first_minute[last_bar + 1]) if last_bar + 1 < len(bars) else len(minutes)
            self.push(expires, EXPIRE, (rule, cancelled))

    # --- o ciclo ----------------------------------------------------------
    def main_progress(self, fraction: float) -> None:
        if self.lite:
            self.on_progress(fraction)
            return
        # Com relatório, o ciclo é só a primeira parte da barra; o fim prevê-se
        # com o que falta dele e as variantes, cada uma como ele inteiro
        elapsed = time.monotonic() - self.started
        whole = elapsed / fraction if fraction > 0 else None
        expected = self.expected
        self.on_progress(fraction * MAIN_SHARE, {
            "phase": "simulating",
            "bars": self.span,
            "variantsTotal": expected,
            "estimatedEndAt": int((time.time() + whole * (1 - fraction) + whole * expected) * 1000) if whole else None,
        })

    def loop(self) -> None:
        """Os sinais candidatos e os acontecimentos (saídas, reforços, ordens, liquidações) por ordem de tempo."""
        bars, minutes, funnel, events = self.bars, self.minutes, self.funnel, self.events
        candidate_bars, candidate_rules = self.candidate_bars, self.candidate_rules
        journal, first_bar = self.journal, self.first_bar
        self.span = span = len(bars) - first_bar
        self.expected = 0 if self.lite else _variants_expected(self.strategy, self.entries)
        order_stats, pending_by_rule = self.order_stats, self.pending_by_rule
        cursor = 0
        total = len(candidate_bars)
        while True:
            next_minute = int(bars.first_minute[candidate_bars[cursor]]) if cursor < total else None
            if events and (next_minute is None or events[0][0] <= next_minute):
                minute, kind, _, payload = heapq.heappop(events)
                if kind == LIQUIDATE:
                    key, generation, level = payload
                    if self.watching(key, generation):
                        self.liquidate(key, minute, level)
                elif kind == RECHECK:
                    key, generation = payload
                    if self.watching(key, generation):
                        self.watch(key, minute, again=False)
                elif kind == EXIT:
                    if payload.closed:  # já liquidada
                        continue
                    # Ao vivo, a que chega ao fim das velas continua aberta
                    if journal is not None and payload.exit_reason == "end":
                        self.still_open.append(payload)
                        continue
                    self.close_position(payload)
                elif kind == ADD:
                    self.add_to(*payload)
                elif kind == EXPIRE:
                    rule, cancelled = payload
                    # Ao vivo, uma ordem que vale para lá das velas continua à espera
                    if journal is not None and minute >= len(minutes):
                        self.still_pending.append(rule)
                        continue
                    pending_by_rule[rule] -= 1
                    funnel["ordersExpired"] += 1
                    order_stats["cancelled" if cancelled else "expired"][rule] += 1
                    if journal is not None:
                        journal.append({"kind": "cancelled" if cancelled else "expired", "minute": minute, "rule": rule})
                else:
                    rule, bar, (fill_minute, price, rising) = payload
                    pending_by_rule[rule] -= 1
                    before = dict(funnel) if journal is not None else None
                    closed_here = (
                        self.opposite == "close"
                        and self.closed_by_opposite[self.directions[rule]] == self.bar_of(fill_minute)
                    )
                    if (
                        not closed_here
                        and not _in_periods(int(minutes.time[fill_minute]), self.period_index)
                        and self.can_hold(rule)
                    ):
                        opened = self.open_position(rule, bar, fill_minute, price, rising)
                        order_stats["filled" if opened else "expired"][rule] += 1
                    else:
                        # O preço chegou lá, mas a posição já não podia abrir: a ordem cai
                        opened = False
                        funnel["ordersExpired"] += 1
                        order_stats["expired"][rule] += 1
                    if journal is not None:
                        journal.append({
                            "kind": "filled" if opened else "fillFailed", "minute": fill_minute, "rule": rule,
                            "price": float(price), "reason": None if opened else self.outcome(before),
                        })
                continue
            if next_minute is None:
                break
            # Sem capital, sem posições e sem depósitos para vir, já não entra nada
            if self.capital <= 0 and not self.open_total and self.paid >= len(self.deposits):
                # Os sinais que ainda faltavam também contam, sem capital
                funnel["signals"] += total - cursor
                for rule, count in enumerate(np.bincount(candidate_rules[cursor:], minlength=len(self.entries))):
                    self.signals_by_rule[rule] += int(count)
                funnel["noCapital"] += total - cursor
                break

            bar, rule = int(candidate_bars[cursor]), int(candidate_rules[cursor])
            cursor += 1
            if cursor % 256 == 0:
                self.main_progress((bar - first_bar) / span)
            if journal is None:
                self.place(bar, rule)
            else:
                before = dict(funnel)
                self.place(bar, rule)
                journal.append({"kind": "signal", "bar": bar, "rule": rule, "outcome": self.outcome(before)})

    def finish(self) -> tuple[list[Trade], dict, dict]:
        """Depois do ciclo: o resumo, o que o teste ao vivo mostra e o relatório (ou, nas variantes, as contas delas)."""
        bars, minutes, trades, initial = self.bars, self.minutes, self.trades, self.initial
        deposits, deposit_amounts, first_bar = self.deposits, self.deposit_amounts, self.first_bar
        # Os depósitos continuam a entrar até ao fim, mesmo sem trades
        self.take_deposits(self.end_ms)
        deposited = float(deposit_amounts.sum())
        capital = self.capital

        self.main_progress(1.0)
        summary = summarize(trades, initial, capital, bars, first_bar, self.entries, deposited)
        summary.update(
            totalFunding=sum(trade.funding for trade in trades),
            skippedOrders=self.skipped,
            maxOpenPositions=self.most_open,
            inBase=_in_base(initial, capital, deposits, deposit_amounts, bars, first_bar, minutes),
        )
        if self.live is not None:
            paid = self.paid
            self.live.update(
                open=self.still_open,
                pending=self.still_pending,
                journal=self.journal,
                deposits=[(int(when), float(amount)) for when, amount in zip(deposits[:paid], deposit_amounts[:paid])],
                capital=capital,
                marginUsed=self.margin_used,
                pausedUntil=self.paused_until,
                setup=[order.setup_events for order in self.entry_orders],
                chart=self.chart,
                first_bar=first_bar,
            )
        if self.lite:
            drawdown = factsheet.max_drawdown(
                trades, initial, deposits, deposit_amounts, minutes, self.start_ms, self.end_ms
            )
            if progress.current is not None:
                progress.current.variant()
            return trades, summary, {
                "orderStats": self.order_stats, "maxDrawdownPct": drawdown, "funnel": self.funnel,
                "addStats": self.add_stats,
            }
        progress.current = ReportProgress(
            self.on_progress, self.expected, time.monotonic() - self.started, {"bars": self.span, "trades": len(trades)}
        )
        progress.current.emit()
        # Aqui e não no topo: o relatório corre a simulação outra vez (as variantes)
        from .report.build import _report

        # 2.2 e 4.9 as regras da entrada: a preparação (só os acontecimentos do período), as
        # condições da conta e os reforços
        rule_stats = {
            "setup": [_setup_events(order.setup_events, first_bar) for order in self.entry_orders],
            "context": self.context_blocks,
            "adds": self.add_stats,
        }
        try:
            return _report(
                bars, first_bar, minutes, self.strategy, self.start_ms, self.end_ms, self.timeframe, self.funding,
                trades, summary, initial, capital, deposits, deposit_amounts, self.most_open, self.fee_entry,
                self.entries, self.order_stats, self.funnel, self.signals_by_rule, self.clock, self.funding_times,
                self.funding_rates, self.funding_minutes, rule_stats, self.chart,
            )
        finally:
            progress.current = None


def _setup_events(events: dict | None, first_bar: int) -> dict | None:
    """Os acontecimentos da preparação de uma entrada a partir do início do período."""
    if events is None:
        return None
    own = {key: [bar for bar in events[key] if bar >= first_bar] for key in ("arm", "rearm", "expire", "cancel")}
    own["fire"] = [item for item in events["fire"] if item[0] >= first_bar]
    return own

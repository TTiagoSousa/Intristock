"""O que a simulação prepara antes do ciclo: as opções da estratégia, os
horários, as ordens de cada entrada e de cada saída, os sinais candidatos e o
estado inicial da conta. As partes do ciclo (`planning`, `positions`,
`liquidation` e `simulate`) são métodos da mesma classe e leem daqui."""

import math
import time
from collections.abc import Callable

import numpy as np

from .. import factsheet
from ..market.candles import Bars, Candles, empty_bars
from ..strategy import Chart, entry_signal, exit_level
from .capital import _deposits, _funding_schedule
from .clock import (
    _WEEK_MINUTES, Clock, _allowed, _blocked_bars, _excluded_periods, _in_periods, _matches, _period_index,
)
from .constants import MINUTE_MS
from .context import AccountContext
from .entries import _order, normalize
from .execution import _market_prices
from .models import NoCandlesError, Position, Trade
from .stop_rules import StopRules


class Prepared:
    """As séries e as opções da simulação, e o estado da conta no início."""

    def __init__(
        self,
        bars: Bars,
        minutes: Candles,
        strategy: dict,
        start_ms: int,
        on_progress: Callable[[float], None],
        timeframe: str | None,
        funding,
        lite: bool,
        live: dict | None,
    ):
        self.bars, self.minutes, self.strategy, self.start_ms = bars, minutes, strategy, start_ms
        self.on_progress, self.timeframe, self.funding, self.lite, self.live = on_progress, timeframe, funding, lite, live
        self.started = time.monotonic()
        # As velas antes do início só servem para aquecer as médias
        first_bar = int(np.searchsorted(bars.time, start_ms, side="left"))
        if first_bar >= len(bars):
            raise NoCandlesError("Não há velas neste período")
        self.first_bar = first_bar

        end_ms = self.end_ms = int(minutes.time[-1])
        self.initial = initial = float(strategy["initialCapital"])
        self.fee_entry = float(strategy.get("feeEntryPct", strategy["feePct"])) / 100
        self.fee_exit = float(strategy.get("feeExitPct", strategy["feePct"])) / 100
        self.slippage = float(strategy.get("slippagePct") or 0) / 100
        self.compound = strategy.get("compounding", True)
        self.deposits, self.deposit_amounts = _deposits(strategy, start_ms, end_ms)
        self.market = _market_prices(bars, minutes, strategy.get("executionPrice"))
        # As velas paradas (um buraco nos dados, sem minutos): sem negócios, nada entra
        # nem sai nelas ao mercado; os stops e os níveis veem-se nos minutos que há
        self.empty = empty = empty_bars(bars, len(minutes))
        self.real_bars = np.flatnonzero(~empty)

        general_sizing = strategy.get("sizing") or {}
        self.sizing_rules = strategy.get("sizingRules") or []

        # Sem alavancagem definida (spot, simulações antigas) não há liquidação
        general_leverage = strategy.get("leverage")
        self.cross = strategy.get("marginMode") == "cross"
        self.maintenance = float(strategy.get("maintenanceMarginPct", 0.5)) / 100

        self.step = float(strategy.get("quantityStep") or 0)
        self.min_quantity = float(strategy.get("minQuantity") or 0)
        self.min_notional = float(strategy.get("minNotional") or 0)

        self.max_positions = max(1, int(strategy.get("maxPositions") or 1))
        self.opposite = strategy.get("opposite") or "ignore"
        self.cooldown = int(strategy.get("cooldownBars") or 0)
        self.cooldown_any = (strategy.get("cooldownAfter") or "any") == "any"
        daily = strategy.get("dailyLimits") or {}
        self.max_day_losses = int(daily.get("maxLosses") or 0)
        self.max_day_loss = float(daily.get("maxLossPct") or 0) / 100
        self.guards = strategy.get("tradingGuards") or []

        self.clock = clock = Clock(strategy.get("timezone"), int(bars.time[0]), end_ms)
        # As variantes da 5.9 (só internas, o pedido nunca as traz) juntam janelas
        # absolutas em ms UTC, que fecham as posições como um período excluído
        # (`_closedWindows`), e horas bloqueadas na hora UTC (`_blockedUtc`)
        periods = sorted(
            _excluded_periods(clock, strategy.get("excludedPeriods"))
            + [(int(start), int(end)) for start, end in strategy.get("_closedWindows") or []]
        )
        self.period_index = _period_index(periods)
        blocked = _blocked_bars(bars, clock, strategy.get("blockedTimes"))
        blocked |= _in_periods(bars.time, self.period_index)
        if strategy.get("_blockedUtc"):
            blocked |= _matches(np.asarray(bars.time, np.int64), strategy["_blockedUtc"])
        self.blocked = blocked
        # Onde as posições abertas fecham à força: no início de cada período excluído
        forced = np.array(
            sorted({int(np.searchsorted(minutes.time, start, side="left")) for start, _ in periods}), np.int64
        )
        self.forced = forced[forced < len(minutes)]

        self.funding_times, self.funding_rates = _funding_schedule(strategy, funding, start_ms, end_ms)
        self.funding_minutes = np.clip(
            np.searchsorted(minutes.time, self.funding_times, side="left"), 0, len(minutes) - 1
        )

        self.entries = entries = normalize(strategy)
        # As condições podem pedir velas de outros tempos gráficos (o `timeframe`
        # é o da simulação, para não as voltar a fazer)
        self.chart = chart = Chart(bars, minutes, timeframe, clock)
        self.entry_orders = entry_orders = [
            _order(chart, entry["conditions"], entry.get("price"), entry.get("match"), entry.get("setup"))
            for entry in entries
        ]
        self.exit_orders = exit_orders = [
            [_order(chart, exit["conditions"], exit["price"], exit.get("match")) for exit in entry.get("exits") or []]
            for entry in entries
        ]
        if empty.any():
            for order in entry_orders + [order for orders in exit_orders for order in orders]:
                order.hits = order.hits[~empty[order.hits]]
        self.directions = directions = [1 if entry["side"] == "long" else -1 for entry in entries]
        # O stop num nível (o preço de uma vela, uma média, um valor), como se sabe na abertura de cada vela
        self.stop_levels = [
            exit_level(chart, entry["stopLossLevel"])
            if entry.get("stopLossMode") == "level" and entry.get("stopLossLevel")
            else None
            for entry in entries
        ]
        # Os ajustes do stop (stopRules) e os reforços com condição: as velas em que cada um se cumpre
        self.stop_rules = StopRules(chart, entries)
        self.add_hits = [
            [
                np.flatnonzero(entry_signal(chart, add.get("conditions") or [], add.get("match")) & ~empty)
                if add.get("trigger") == "conditions"
                else None
                for add in entry.get("scaleIns") or []
            ]
            for entry in entries
        ]
        self.account = AccountContext(entries, initial, clock)

        # Por entrada: o tamanho ("tudo" é 100% do capital, para as regras de
        # ajuste servirem a todos), a alavancagem e onde pode entrar
        self.sizings = []
        for entry in entries:
            own = entry.get("sizing") or general_sizing
            mode = own.get("mode") or "all"
            self.sizings.append((mode, 100.0 if mode == "all" else float(own.get("value") or 0)))
        self.leverages = [entry.get("leverage") or general_leverage for entry in entries]
        local_bars = clock.local(bars.time)
        self.entry_allowed = [_allowed(local_bars, entry.get("schedule")) for entry in entries]

        # Uma saída com horário só acontece nas velas em que vale
        for entry, orders in zip(entries, exit_orders):
            for exit, order in zip(entry.get("exits") or [], orders):
                allowed = _allowed(local_bars, exit.get("schedule"))
                if allowed is not None:
                    order.hits = order.hits[allowed[order.hits]]

        # O stop e o take profit com horário: em que minutos valem (feito uma vez por horário)
        self.minute_masks: dict[str, np.ndarray | None] = {}
        self.local_minutes = None

        # Uma ordem num nível só entra nos minutos que o horário deixa: fora dos
        # `blockedTimes` (e dos `_blockedUtc`) e no horário da entrada. Vê-se aos
        # bocados, só nos minutos em que se procura, como o sinal na hora local. Os
        # horários repetem-se todas as semanas: vê-se numa semana de minutos e depois
        # é só procurar o minuto da semana de cada um
        self.blocked_times = strategy.get("blockedTimes") or []
        blocked_utc = strategy.get("_blockedUtc") or []
        self.week_size = len(_WEEK_MINUTES)
        self.week_start = int(_WEEK_MINUTES[0]) // MINUTE_MS
        self.utc_week = ~_matches(_WEEK_MINUTES, blocked_utc) if blocked_utc else None

        self.fill_masks = [self.fill_allowed(rule) for rule in range(len(entries))]
        self.validity = validity = [max(1, int(entry.get("orderBars") or 1)) for entry in entries]
        self.rule_limit = [max(1, int(entry.get("maxPositions") or 1)) for entry in entries]

        # Onde cada entrada pode pôr uma ordem: com validade de uma vela, só onde
        # o preço chega ao nível; com mais, onde as condições se cumprem
        candidate_bars, candidate_rules = [], []
        for index, order in enumerate(entry_orders):
            # (uma ordem num nível pode ficar desde uma vela parada: entra quando houver minutos)
            own = order.hits if order.market or validity[index] == 1 else np.flatnonzero(order.active)
            own = own[own >= first_bar]
            candidate_bars.append(own)
            candidate_rules.append(np.full(len(own), index, np.int64))
        candidate_bars = np.concatenate(candidate_bars) if candidate_bars else np.empty(0, np.int64)
        candidate_rules = np.concatenate(candidate_rules) if candidate_rules else np.empty(0, np.int64)
        sorting = np.lexsort((candidate_rules, candidate_bars))
        self.candidate_bars, self.candidate_rules = candidate_bars[sorting], candidate_rules[sorting]

        # Os sinais de cada direção, para o sinal contrário fechar posições
        self.opposite_signals = {}
        for direction in (1, -1):
            own = [index for index, value in enumerate(directions) if value == -direction]
            signal_bars = np.concatenate([entry_orders[index].hits for index in own]) if own else np.empty(0, np.int64)
            signal_rules = (
                np.concatenate([np.full(len(entry_orders[index].hits), index) for index in own])
                if own
                else np.empty(0, np.int64)
            )
            sorting = np.lexsort((signal_rules, signal_bars))
            self.opposite_signals[direction] = (signal_bars[sorting], signal_rules[sorting])

        self._initial_state()

    def _initial_state(self) -> None:
        entries, initial = self.entries, self.initial
        self.capital = initial
        self.contributed = initial  # o inicial e os depósitos que já entraram
        self.paid = 0  # depósitos que já entraram
        self.margin_used = 0.0
        self.open_total = 0
        self.open_by_direction = {1: 0, -1: 0}
        self.open_by_rule = [0] * len(entries)
        self.pending_by_rule = [0] * len(entries)
        self.pending_until = [-1] * len(entries)  # até que vela a ordem de cada entrada está viva
        self.next_allowed_bar = self.first_bar  # a pausa depois de uma saída
        self.closed_by_opposite = {1: -1, -1: -1}  # vela em que o sinal desta direção fechou a outra
        # O ajuste das regras de tamanho: None, ("set", valor) ou ("multiply", fator)
        self.sizing_adjust, self.sizing_left = None, 0
        self.history: list[tuple[int, float, str, float]] = []  # (saída, pnl, motivo, capital antes)
        self.paused_until = 0  # as regras gerais param as entradas até aqui
        self.streak_wins = self.streak_losses = 0
        self.day_key, self.day_losses, self.day_pnl, self.day_capital = None, 0, 0.0, initial
        self.skipped = 0  # ordens que não entraram por falta de capital ou abaixo do mínimo
        # 2.2 o funil: cada sinal conta uma vez, no primeiro motivo que o parou (ou na ordem que pôs)
        self.funnel = dict.fromkeys(factsheet.FUNNEL_KEYS, 0)
        self.signals_by_rule = [0] * len(entries)  # 2.2 os sinais de cada entrada
        # 2.3 as ordens num nível de cada entrada: postas, executadas, caídas (o
        # preço não chegou, ou chegou e a posição já não podia abrir) e canceladas
        self.order_stats = {key: [0] * len(entries) for key in ("placed", "filled", "expired", "cancelled")}
        # 4.9 as regras da entrada: os sinais que cada condição da conta parou e, por
        # reforço, os que o preço alcançou antes da saída, os que entraram (e quantos
        # com menos do que o pedido), os que não couberam no capital e os abaixo do mínimo
        self.context_blocks = [[0] * len(entry.get("context") or []) for entry in entries]
        self.add_stats = [
            [dict.fromkeys(("reached", "filled", "reduced", "noCapital", "rejectedMinimum"), 0)
             for _ in entry.get("scaleIns") or []]
            for entry in entries
        ]
        self.most_open = 0
        self.open_positions: list[Position] = []
        self.cross_watch = 0  # a vigia da liquidação da margem cruzada (como `Position.watch`)
        # O teste ao vivo: o que aconteceu a cada sinal e às ordens, as posições que
        # continuam abertas e as entradas com uma ordem à espera
        self.journal: list | None = [] if self.live is not None else None
        self.still_open: list[Position] = []
        self.still_pending: list[int] = []
        self.trades: list[Trade] = []
        self.events: list = []
        self.sequence = 0

    # --- ajudas -----------------------------------------------------------
    def minute_mask(self, schedule):
        if not (schedule or {}).get("rules"):
            return None
        key = repr(schedule)
        if key not in self.minute_masks:
            if self.local_minutes is None:
                self.local_minutes = self.clock.local(self.minutes.time)
            self.minute_masks[key] = _allowed(self.local_minutes, schedule)
        return self.minute_masks[key]

    def fill_allowed(self, rule: int):
        local_week = _allowed(_WEEK_MINUTES, self.entries[rule].get("schedule"))
        if self.blocked_times:
            free = ~_matches(_WEEK_MINUTES, self.blocked_times)
            local_week = free if local_week is None else local_week & free
        utc_week = self.utc_week
        if local_week is None and utc_week is None:
            return None
        minutes, clock, week_start, week_size = self.minutes, self.clock, self.week_start, self.week_size

        def allowed(start: int, end: int) -> np.ndarray:
            times = minutes.time[start:end]
            mask = np.ones(len(times), bool)
            if local_week is not None:
                mask &= local_week[(clock.local(times) // MINUTE_MS - week_start) % week_size]
            if utc_week is not None:
                mask &= utc_week[(times // MINUTE_MS - week_start) % week_size]
            return mask

        return allowed

    def slip(self, price: float, buying: bool) -> float:
        return price * (1 + self.slippage) if buying else price * (1 - self.slippage)

    def bar_of(self, minute: int) -> int:
        return int(np.searchsorted(self.bars.time, self.minutes.time[minute], side="right")) - 1

    def initial_stop(self, rule: int, bar: int, raw_entry: float, direction: int):
        """O stop ao entrar na vela `bar`: a % do preço, a mínima (numa compra) ou a
        máxima (numa venda) das últimas N velas fechadas, ou o nível da entrada,
        com a folga. None sem stop; NaN se não serve (do lado errado do preço)."""
        entry = self.entries[rule]
        mode = entry.get("stopLossMode") or "pct"
        if mode == "pct":
            pct = (entry.get("stopLossPct") or 0) / 100
            return raw_entry * (1 - direction * pct) if pct else None
        if mode == "swing":
            start = max(0, bar - int(entry.get("stopLossBars") or 0))
            if start >= bar:
                return math.nan
            bars = self.bars
            level = float(bars.low[start:bar].min() if direction == 1 else bars.high[start:bar].max())
        else:
            level = float(self.stop_levels[rule][bar])
        level *= 1 - direction * float(entry.get("stopLossBufferPct") or 0) / 100
        if math.isnan(level) or direction * (level - raw_entry) >= 0:
            return math.nan
        return level

    def target_of(self, rule: int, raw_entry: float, direction: int, stop):
        """O take profit: a % do preço ou um múltiplo da distância ao stop (R)."""
        entry = self.entries[rule]
        if entry.get("takeProfitR"):
            return raw_entry + direction * float(entry["takeProfitR"]) * abs(raw_entry - stop) if stop else None
        pct = (entry.get("takeProfitPct") or 0) / 100
        return raw_entry * (1 + direction * pct) if pct else None

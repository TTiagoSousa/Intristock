"""O ciclo da simulação: sinais, ordens, posições e saídas, por ordem de tempo."""

import heapq
import math
import time
from collections.abc import Callable

import numpy as np

from .. import factsheet
from ..market.candles import Bars, Candles, empty_bars
from ..strategy import Chart, entry_signal, exit_level
from .capital import _deposits, _funding_schedule
from .clock import (
    _WEEK_MINUTES, Clock, _allowed, _blocked_bars, _duration, _excluded_periods, _in_periods, _matches, _period_index,
)
from .constants import ADD, EXIT, EXPIRE, FILL, LIQUIDATE, MINUTE_MS, RECHECK, STOP_REASONS
from .context import AccountContext
from .entries import _order, normalize
from .execution import SEARCH_WINDOW, _fill, _find_stop, _market_prices, _reach, _slipped, _touch
from .models import NoCandlesError, Position, Trade
from . import progress
from .progress import MAIN_SHARE, ReportProgress, _variants_expected
from .stop_rules import StopRules
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
    started = time.monotonic()
    # As velas antes do início só servem para aquecer as médias
    first_bar = int(np.searchsorted(bars.time, start_ms, side="left"))
    if first_bar >= len(bars):
        raise NoCandlesError("Não há velas neste período")

    end_ms = int(minutes.time[-1])
    initial = float(strategy["initialCapital"])
    fee_entry = float(strategy.get("feeEntryPct", strategy["feePct"])) / 100
    fee_exit = float(strategy.get("feeExitPct", strategy["feePct"])) / 100
    slippage = float(strategy.get("slippagePct") or 0) / 100
    compound = strategy.get("compounding", True)
    deposits, deposit_amounts = _deposits(strategy, start_ms, end_ms)
    market = _market_prices(bars, minutes, strategy.get("executionPrice"))
    # As velas paradas (um buraco nos dados, sem minutos): sem negócios, nada entra
    # nem sai nelas ao mercado; os stops e os níveis veem-se nos minutos que há
    empty = empty_bars(bars, len(minutes))
    real_bars = np.flatnonzero(~empty)

    general_sizing = strategy.get("sizing") or {}
    sizing_rules = strategy.get("sizingRules") or []

    # Sem alavancagem definida (spot, simulações antigas) não há liquidação
    general_leverage = strategy.get("leverage")
    cross = strategy.get("marginMode") == "cross"
    maintenance = float(strategy.get("maintenanceMarginPct", 0.5)) / 100

    step = float(strategy.get("quantityStep") or 0)
    min_quantity = float(strategy.get("minQuantity") or 0)
    min_notional = float(strategy.get("minNotional") or 0)

    max_positions = max(1, int(strategy.get("maxPositions") or 1))
    opposite = strategy.get("opposite") or "ignore"
    cooldown = int(strategy.get("cooldownBars") or 0)
    cooldown_any = (strategy.get("cooldownAfter") or "any") == "any"
    daily = strategy.get("dailyLimits") or {}
    max_day_losses = int(daily.get("maxLosses") or 0)
    max_day_loss = float(daily.get("maxLossPct") or 0) / 100
    guards = strategy.get("tradingGuards") or []

    clock = Clock(strategy.get("timezone"), int(bars.time[0]), end_ms)
    # As variantes da 5.9 (só internas, o pedido nunca as traz) juntam janelas
    # absolutas em ms UTC, que fecham as posições como um período excluído
    # (`_closedWindows`), e horas bloqueadas na hora UTC (`_blockedUtc`)
    periods = sorted(
        _excluded_periods(clock, strategy.get("excludedPeriods"))
        + [(int(start), int(end)) for start, end in strategy.get("_closedWindows") or []]
    )
    period_index = _period_index(periods)
    blocked = _blocked_bars(bars, clock, strategy.get("blockedTimes"))
    blocked |= _in_periods(bars.time, period_index)
    if strategy.get("_blockedUtc"):
        blocked |= _matches(np.asarray(bars.time, np.int64), strategy["_blockedUtc"])
    # Onde as posições abertas fecham à força: no início de cada período excluído
    forced = np.array(
        sorted({int(np.searchsorted(minutes.time, start, side="left")) for start, _ in periods}), np.int64
    )
    forced = forced[forced < len(minutes)]

    funding_times, funding_rates = _funding_schedule(strategy, funding, start_ms, end_ms)
    funding_minutes = np.clip(np.searchsorted(minutes.time, funding_times, side="left"), 0, len(minutes) - 1)

    entries = normalize(strategy)
    # As condições podem pedir velas de outros tempos gráficos (o `timeframe`
    # é o da simulação, para não as voltar a fazer)
    chart = Chart(bars, minutes, timeframe, clock)
    entry_orders = [
        _order(chart, entry["conditions"], entry.get("price"), entry.get("match"), entry.get("setup"))
        for entry in entries
    ]
    exit_orders = [
        [_order(chart, exit["conditions"], exit["price"], exit.get("match")) for exit in entry.get("exits") or []]
        for entry in entries
    ]
    if empty.any():
        for order in entry_orders + [order for orders in exit_orders for order in orders]:
            order.hits = order.hits[~empty[order.hits]]
    directions = [1 if entry["side"] == "long" else -1 for entry in entries]
    # O stop num nível (o preço de uma vela, uma média, um valor), como se sabe na abertura de cada vela
    stop_levels = [
        exit_level(chart, entry["stopLossLevel"])
        if entry.get("stopLossMode") == "level" and entry.get("stopLossLevel")
        else None
        for entry in entries
    ]
    # Os ajustes do stop (stopRules) e os reforços com condição: as velas em que cada um se cumpre
    stop_rules = StopRules(chart, entries)
    add_hits = [
        [
            np.flatnonzero(entry_signal(chart, add.get("conditions") or [], add.get("match")) & ~empty)
            if add.get("trigger") == "conditions"
            else None
            for add in entry.get("scaleIns") or []
        ]
        for entry in entries
    ]
    account = AccountContext(entries, initial, clock)

    # Por entrada: o tamanho ("tudo" é 100% do capital, para as regras de
    # ajuste servirem a todos), a alavancagem e onde pode entrar
    sizings = []
    for entry in entries:
        own = entry.get("sizing") or general_sizing
        mode = own.get("mode") or "all"
        sizings.append((mode, 100.0 if mode == "all" else float(own.get("value") or 0)))
    leverages = [entry.get("leverage") or general_leverage for entry in entries]
    local_bars = clock.local(bars.time)
    entry_allowed = [_allowed(local_bars, entry.get("schedule")) for entry in entries]

    # Uma saída com horário só acontece nas velas em que vale
    for entry, orders in zip(entries, exit_orders):
        for exit, order in zip(entry.get("exits") or [], orders):
            allowed = _allowed(local_bars, exit.get("schedule"))
            if allowed is not None:
                order.hits = order.hits[allowed[order.hits]]

    # O stop e o take profit com horário: em que minutos valem (feito uma vez por horário)
    minute_masks: dict[str, np.ndarray | None] = {}
    local_minutes = None

    def minute_mask(schedule):
        nonlocal local_minutes
        if not (schedule or {}).get("rules"):
            return None
        key = repr(schedule)
        if key not in minute_masks:
            if local_minutes is None:
                local_minutes = clock.local(minutes.time)
            minute_masks[key] = _allowed(local_minutes, schedule)
        return minute_masks[key]

    # Uma ordem num nível só entra nos minutos que o horário deixa: fora dos
    # `blockedTimes` (e dos `_blockedUtc`) e no horário da entrada. Vê-se aos
    # bocados, só nos minutos em que se procura, como o sinal na hora local. Os
    # horários repetem-se todas as semanas: vê-se numa semana de minutos e depois
    # é só procurar o minuto da semana de cada um
    blocked_times = strategy.get("blockedTimes") or []
    blocked_utc = strategy.get("_blockedUtc") or []
    week_size = len(_WEEK_MINUTES)
    week_start = int(_WEEK_MINUTES[0]) // MINUTE_MS
    utc_week = ~_matches(_WEEK_MINUTES, blocked_utc) if blocked_utc else None

    def fill_allowed(rule: int):
        local_week = _allowed(_WEEK_MINUTES, entries[rule].get("schedule"))
        if blocked_times:
            free = ~_matches(_WEEK_MINUTES, blocked_times)
            local_week = free if local_week is None else local_week & free
        if local_week is None and utc_week is None:
            return None

        def allowed(start: int, end: int) -> np.ndarray:
            times = minutes.time[start:end]
            mask = np.ones(len(times), bool)
            if local_week is not None:
                mask &= local_week[(clock.local(times) // MINUTE_MS - week_start) % week_size]
            if utc_week is not None:
                mask &= utc_week[(times // MINUTE_MS - week_start) % week_size]
            return mask

        return allowed

    fill_masks = [fill_allowed(rule) for rule in range(len(entries))]
    validity = [max(1, int(entry.get("orderBars") or 1)) for entry in entries]
    rule_limit = [max(1, int(entry.get("maxPositions") or 1)) for entry in entries]

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
    candidate_bars, candidate_rules = candidate_bars[sorting], candidate_rules[sorting]

    # Os sinais de cada direção, para o sinal contrário fechar posições
    opposite_signals = {}
    for direction in (1, -1):
        own = [index for index, value in enumerate(directions) if value == -direction]
        signal_bars = np.concatenate([entry_orders[index].hits for index in own]) if own else np.empty(0, np.int64)
        signal_rules = (
            np.concatenate([np.full(len(entry_orders[index].hits), index) for index in own])
            if own
            else np.empty(0, np.int64)
        )
        sorting = np.lexsort((signal_rules, signal_bars))
        opposite_signals[direction] = (signal_bars[sorting], signal_rules[sorting])

    def slip(price: float, buying: bool) -> float:
        return price * (1 + slippage) if buying else price * (1 - slippage)

    def bar_of(minute: int) -> int:
        return int(np.searchsorted(bars.time, minutes.time[minute], side="right")) - 1

    def initial_stop(rule: int, bar: int, raw_entry: float, direction: int):
        """O stop ao entrar na vela `bar`: a % do preço, a mínima (numa compra) ou a
        máxima (numa venda) das últimas N velas fechadas, ou o nível da entrada,
        com a folga. None sem stop; NaN se não serve (do lado errado do preço)."""
        entry = entries[rule]
        mode = entry.get("stopLossMode") or "pct"
        if mode == "pct":
            pct = (entry.get("stopLossPct") or 0) / 100
            return raw_entry * (1 - direction * pct) if pct else None
        if mode == "swing":
            start = max(0, bar - int(entry.get("stopLossBars") or 0))
            if start >= bar:
                return math.nan
            level = float(bars.low[start:bar].min() if direction == 1 else bars.high[start:bar].max())
        else:
            level = float(stop_levels[rule][bar])
        level *= 1 - direction * float(entry.get("stopLossBufferPct") or 0) / 100
        if math.isnan(level) or direction * (level - raw_entry) >= 0:
            return math.nan
        return level

    def target_of(rule: int, raw_entry: float, direction: int, stop):
        """O take profit: a % do preço ou um múltiplo da distância ao stop (R)."""
        entry = entries[rule]
        if entry.get("takeProfitR"):
            return raw_entry + direction * float(entry["takeProfitR"]) * abs(raw_entry - stop) if stop else None
        pct = (entry.get("takeProfitPct") or 0) / 100
        return raw_entry * (1 + direction * pct) if pct else None

    def plan_exit(
        rule: int, direction: int, entry_bar: int, entry_minute: int, raw_entry: float, stop, target,
        start: int | None = None, best: float | None = None, stop_reason: str = "stop_loss", path=None,
    ):
        """Como e quando sai a posição: a primeira saída que acontecer. Depois de
        uma saída parcial volta-se a ver a partir dela (`start`), com o melhor preço
        até lá e o stop que tiver nessa altura. `path` é o stop movido pelos ajustes.
        A liquidação não entra aqui: vê-se à parte (`watch`), porque depende do
        tamanho, do preço médio e, na margem cruzada, das outras posições."""
        entry = entries[rule]

        # A saída com condição que acontece primeiro: (minuto, preço, saída, sentido, motivo)
        signal = None
        signal_bar = None
        for exit_index, order in enumerate(exit_orders[rule]):
            # Ao mercado só a partir da vela seguinte; um nível já na da
            # entrada, mas depois do minuto em que entrou
            side = "right" if order.market else "left"
            position = int(np.searchsorted(order.hits, entry_bar, side=side))
            fill = None
            while position < len(order.hits) and fill is None:
                hit_bar = int(order.hits[position])
                same = hit_bar == entry_bar
                fill = _fill(
                    order,
                    bars,
                    minutes,
                    hit_bar,
                    market,
                    entry_minute if same else None,
                    raw_entry if same else None,
                )
                position += 1
            if fill is None or (signal_bar is not None and hit_bar > signal_bar):
                continue
            minute, price, rising = fill
            if signal is None or hit_bar < signal_bar or minute < signal[0]:
                signal = (minute, price, exit_index + 1, rising, "signal")
                signal_bar = hit_bar

        # Uma entrada da outra direção a dar sinal fecha a posição
        if opposite in ("close", "reverse"):
            signal_bars, signal_rules = opposite_signals[direction]
            position = int(np.searchsorted(signal_bars, entry_bar, side="right"))
            if position < len(signal_bars):
                hit_bar = int(signal_bars[position])
                fill = _fill(entry_orders[int(signal_rules[position])], bars, minutes, hit_bar, market)
                if fill and (signal is None or fill[0] < signal[0]):
                    signal = (fill[0], fill[1], None, fill[2], "opposite")

        # Ao fim de N velas sai ao mercado (numa vela parada, na primeira com minutos a seguir)
        max_bars = int(entry.get("maxBars") or 0)
        at = int(np.searchsorted(real_bars, entry_bar + max_bars)) if max_bars else len(real_bars)
        if at < len(real_bars):
            time_bar = int(real_bars[at])
            minute = int(bars.first_minute[time_bar])
            if signal is None or minute < signal[0]:
                signal = (minute, float(market[time_bar]), None, None, "time")

        # O início de um período excluído fecha-a à força
        position = int(np.searchsorted(forced, entry_minute, side="right"))
        if position < len(forced):
            minute = int(forced[position])
            if signal is None or minute < signal[0]:
                signal = (minute, float(minutes.open[minute]), None, None, "excluded")

        # O stop e o take profit só contam se baterem antes (ou no mesmo minuto, o stop)
        limit = signal[0] + 1 if signal else len(minutes)
        trail = entry.get("trailingStopPct")
        break_even = entry.get("breakEvenPct")
        found = _find_stop(
            minutes,
            entry_minute if start is None else start,
            limit,
            direction,
            stop,
            target,
            None,
            raw_entry,
            trail / 100 if trail else None,
            break_even / 100 if break_even else None,
            minute_mask(entry.get("stopLossSchedule")),
            minute_mask(entry.get("takeProfitSchedule")),
            best,
            stop_reason,
            path,
        )
        if found and (signal is None or found[0] < signal[0] or found[1] != "take_profit"):
            # Num stop posto por um ajuste, a saída fica com o número dele (`exit_rule`)
            exit_minute, reason, raw_exit, stop_rule = found
            return exit_minute, float(raw_exit), reason, stop_rule, reason in ("stop_loss", "trailing_stop", "break_even")
        if signal:
            minute, price, exit_rule, rising, reason = signal
            return minute, float(price), reason, exit_rule, _slipped(rising, direction == -1)
        last = len(minutes) - 1
        return last, float(minutes.close[last]), "end", None, True

    # --- estado ---------------------------------------------------------
    capital = initial
    contributed = initial  # o inicial e os depósitos que já entraram
    paid = 0  # depósitos que já entraram
    margin_used = 0.0
    open_total = 0
    open_by_direction = {1: 0, -1: 0}
    open_by_rule = [0] * len(entries)
    pending_by_rule = [0] * len(entries)
    pending_until = [-1] * len(entries)  # até que vela a ordem de cada entrada está viva
    next_allowed_bar = first_bar  # a pausa depois de uma saída
    closed_by_opposite = {1: -1, -1: -1}  # vela em que o sinal desta direção fechou a outra
    # O ajuste das regras de tamanho: None, ("set", valor) ou ("multiply", fator)
    sizing_adjust, sizing_left = None, 0
    history: list[tuple[int, float, str, float]] = []  # (saída, pnl, motivo, capital antes)
    paused_until = 0  # as regras gerais param as entradas até aqui
    streak_wins = streak_losses = 0
    day_key, day_losses, day_pnl, day_capital = None, 0, 0.0, initial
    skipped = 0  # ordens que não entraram por falta de capital ou abaixo do mínimo
    # 2.2 o funil: cada sinal conta uma vez, no primeiro motivo que o parou (ou na ordem que pôs)
    funnel = dict.fromkeys(factsheet.FUNNEL_KEYS, 0)
    signals_by_rule = [0] * len(entries)  # 2.2 os sinais de cada entrada
    # 2.3 as ordens num nível de cada entrada: postas, executadas, caídas (o
    # preço não chegou, ou chegou e a posição já não podia abrir) e canceladas
    order_stats = {key: [0] * len(entries) for key in ("placed", "filled", "expired", "cancelled")}
    # 4.9 as regras da entrada: os sinais que cada condição da conta parou e, por
    # reforço, os que o preço alcançou antes da saída, os que entraram (e quantos
    # com menos do que o pedido), os que não couberam no capital e os abaixo do mínimo
    context_blocks = [[0] * len(entry.get("context") or []) for entry in entries]
    add_stats = [
        [dict.fromkeys(("reached", "filled", "reduced", "noCapital", "rejectedMinimum"), 0)
         for _ in entry.get("scaleIns") or []]
        for entry in entries
    ]
    most_open = 0
    open_positions: list[Position] = []
    cross_watch = 0  # a vigia da liquidação da margem cruzada (como `Position.watch`)
    # O teste ao vivo: o que aconteceu a cada sinal e às ordens, as posições que
    # continuam abertas e as entradas com uma ordem à espera
    journal: list | None = [] if live is not None else None
    still_open: list[Position] = []
    still_pending: list[int] = []

    def outcome(before: dict) -> str:
        """O primeiro motivo do funil que mudou desde `before` (sem nenhum, entrou)."""
        for key, value in funnel.items():
            if key != "signals" and value != before[key]:
                return key
        return "entered"

    trades: list[Trade] = []
    events: list = []
    sequence = 0

    def push(minute: int, kind: int, payload) -> None:
        nonlocal sequence
        sequence += 1
        heapq.heappush(events, (minute, kind, sequence, payload))

    def take_deposits(time_ms: int) -> None:
        nonlocal capital, contributed, paid
        due = int(np.searchsorted(deposits, time_ms, side="right"))
        if due > paid:
            added = float(deposit_amounts[paid:due].sum())
            capital += added
            contributed += added
            paid = due

    def can_hold(rule: int) -> bool:
        direction = directions[rule]
        if open_by_direction[-direction] and opposite != "hedge":
            return False
        return open_total < max_positions and open_by_rule[rule] < rule_limit[rule]

    def open_position(rule: int, bar: int, minute: int, raw_entry: float, rising) -> None:
        nonlocal capital, margin_used, open_total, sizing_adjust, sizing_left, skipped, most_open
        take_deposits(int(minutes.time[minute]))
        direction = directions[rule]
        entry = entries[rule]
        buying = direction == 1
        entry_price = slip(raw_entry, buying) if _slipped(rising, buying) else raw_entry
        free = capital - margin_used
        if free <= 0 or entry_price <= 0:
            skipped += 1
            funnel["noCapital"] += 1
            return False
        # O stop vê as velas fechadas antes da vela em que entra
        stop = initial_stop(rule, bar_of(minute), raw_entry, direction)
        if stop is not None and math.isnan(stop):
            skipped += 1
            funnel["invalidStop"] += 1
            return False
        target = target_of(rule, raw_entry, direction, stop)
        risk = abs(raw_entry - stop) / raw_entry if stop is not None else 0.0

        base = capital if compound else min(contributed, capital)
        sizing_mode, value = sizings[rule]
        if sizing_adjust and sizing_adjust[0] == "set":
            value = sizing_adjust[1]
        elif sizing_adjust:
            value *= sizing_adjust[1]
        leverage = float(leverages[rule] or 1)
        if sizing_mode == "risk":
            if not risk:
                skipped += 1
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
        if step:
            quantity = math.floor(quantity / step + 1e-9) * step
            margin = quantity * entry_price / leverage
        if quantity <= 0 or quantity < min_quantity or quantity * entry_price < min_notional:
            skipped += 1
            funnel["rejectedMinimum"] += 1
            return False

        # As próximas X entradas com o valor ajustado; depois volta ao normal
        if sizing_left:
            sizing_left -= 1
            if not sizing_left:
                sizing_adjust = None

        path = stop_rules.path(rule, direction, bar, minute, raw_entry, stop)
        plan = plan_exit(rule, direction, bar, minute, raw_entry, stop, target, path=path)
        plan, partials, moved = plan_partials(rule, direction, bar, minute, raw_entry, stop, target, plan, path, quantity)
        plan, partials, adds, moved_at = plan_adds(
            rule, direction, bar, minute, raw_entry, stop, target, plan, path, partials, moved
        )
        exit_minute, raw_exit, reason, exit_rule, exit_slipped = plan
        position = Position(
            rule, direction, bar, minute, raw_entry, entry_price, quantity, margin,
            exit_minute, raw_exit, reason, exit_rule, exit_slipped,
            stop_level=stop, take_level=target, partials=partials, planned_adds=adds, path=path, moved_at=moved_at,
        )
        if path is not None:
            position.stop_rules_fired = path.fired_until(bar_of(exit_minute))
        if not lite or live is not None:
            position.stop_moves = stop_history(position, path, moved_at)
        for add in adds:
            add_stats[rule][add[3]]["reached"] += 1
        # Ao mercado, num nível a favor do preço (limite) ou a romper (stop)
        if rising is not None:
            position.order_kind = "stop" if _slipped(rising, buying) else "limit"
            position.wait_bars = bar_of(minute) - bar
            if position.order_kind == "limit":
                position.slippage_saved = quantity * raw_entry * slippage
        margin_used += margin
        open_total += 1
        open_by_direction[direction] += 1
        open_by_rule[rule] += 1
        most_open = max(most_open, open_total)
        account.opened_trade(rule, int(minutes.time[minute]))
        open_positions.append(position)
        push(exit_minute, EXIT, position)
        for add in adds:
            push(add[0], ADD, (position, add))
        if leverages[rule] is not None:
            watch(None if cross else position, minute)
        return True

    def best_until(direction: int, start: int, until: int) -> float | None:
        """O melhor preço de `start` até antes de `until` (o trailing continua dele)."""
        if until <= start:
            return None
        span = slice(start, until)
        return float(minutes.high[span].max() if direction == 1 else minutes.low[span].min())

    def stop_history(position: Position, path, moved_at: int | None) -> list | None:
        """Por onde andou o stop até à saída (para o gráfico): [{time, level}] a
        cada mudança, a começar no da entrada. Contam os ajustes (vela a vela) e
        a passagem à entrada por uma parcial ou um reforço; o trailing e o
        break-even da entrada mexem minuto a minuto e ficam de fora. None se o
        stop nunca mexeu."""
        long = position.direction == 1
        nothing = -math.inf if long else math.inf
        fixed = position.stop_level if position.stop_level is not None else nothing
        changes = []  # (minuto, nível dos ajustes ou None, passou à entrada)
        if path is not None:
            for bar, level in zip(*path.levels_until(bar_of(position.exit_minute))):
                minute = int(bars.first_minute[bar])
                if minute < position.exit_minute:
                    changes.append((minute, float(level), False))
        if moved_at is not None and moved_at < position.exit_minute:
            changes.append((moved_at, None, True))
        changes.sort(key=lambda item: item[0])
        history, moved, current = [], nothing, fixed
        if fixed != nothing:
            history.append({"time": int(minutes.time[position.entry_minute]), "level": fixed})
        for minute, level, to_entry in changes:
            if to_entry:
                fixed = max(fixed, position.raw_entry) if long else min(fixed, position.raw_entry)
            else:
                moved = level
            effective = max(fixed, moved) if long else min(fixed, moved)
            if effective != current and math.isfinite(effective):
                history.append({"time": int(minutes.time[minute]), "level": effective})
                current = effective
        moved_once = len(history) > 1 or (position.stop_level is None and history)
        return history if moved_once else None

    def plan_partials(rule, direction, bar, minute, raw_entry, stop, target, plan, path, quantity):
        """As saídas parciais, da mais perto à mais longe: cada uma acontece se o
        preço lá chegar antes da saída final (no mesmo minuto, só antes do take; o
        stop ganha). Uma que passe o stop para a entrada muda a saída final, que se
        volta a procurar a partir dela. Devolve a saída final e as parciais
        (minuto, preço, fração da quantidade inicial) e o stop, o motivo com que ficou
        e o minuto em que passou à entrada (None se não passou)."""
        parts = entries[rule].get("partialExits") or []
        if not parts:
            return plan, [], (stop, "stop_loss", None)
        levels = []
        for part in parts:
            if part.get("r"):
                if stop is None:
                    continue
                level = raw_entry + direction * float(part["r"]) * abs(raw_entry - stop)
            else:
                level = raw_entry * (1 + direction * float(part.get("pct") or 0) / 100)
            levels.append((level, float(part["closePct"]) / 100, bool(part.get("moveStop"))))
        levels.sort(key=lambda item: direction * (item[0] - raw_entry))

        done, current_stop, stop_reason, moved_at = [], stop, "stop_loss", None
        start = minute
        for level, fraction, move in levels:
            if target is not None and direction * (level - target) >= 0:
                break
            exit_minute, reason = plan[0], plan[2]
            hit = _reach(minutes, start, exit_minute, level, direction)
            if hit is None or (hit[0] == exit_minute and reason != "take_profit"):
                break
            # Como a entrada: arredonda-se ao passo e, abaixo do mínimo da corretora, a
            # ordem não passa (a parcial não acontece e não mexe no stop)
            part = quantity * fraction
            if step:
                part = math.floor(part / step + 1e-9) * step
            if part <= 0 or part < min_quantity or part * hit[1] < min_notional:
                continue
            done.append((hit[0], float(hit[1]), part / quantity))
            if move and (current_stop is None or direction * (raw_entry - current_stop) > 0):
                current_stop, stop_reason, moved_at = raw_entry, "break_even", hit[0]
            # O melhor preço antes do minuto da parcial (o trailing continua dele)
            best = raw_entry
            extreme = best_until(direction, minute, hit[0])
            if extreme is not None:
                best = max(best, extreme) if direction == 1 else min(best, extreme)
            start = hit[0]
            plan = plan_exit(
                rule, direction, bar, minute, raw_entry, current_stop, target, start, best, stop_reason, path,
            )
        return plan, done, (current_stop, stop_reason, moved_at)

    def plan_adds(rule, direction, bar, minute, raw_entry, stop, target, plan, path, partials, moved):
        """Os reforços: juntam uma fração da quantidade inicial quando o preço anda a
        favor X R ou X % (ao nível, como uma ordem stop) ou na abertura da primeira vela
        depois da entrada em que as condições se cumprem (ao mercado). Cada um uma vez,
        antes da saída final; um que passe o stop para a entrada volta a procurar a
        saída a partir dele (as parciais depois da saída nova caem). Devolve a saída,
        as parciais, os reforços (minuto, preço sem slippage, fração, n.º do reforço)
        e o minuto em que o stop passou à entrada (None se não passou)."""
        config = entries[rule].get("scaleIns") or []
        if not config:
            return plan, partials, [], moved[2]
        risk = abs(raw_entry - stop) if stop is not None else None
        found = []
        for index, add in enumerate(config):
            fraction = float(add.get("sizePct") or 0) / 100
            if fraction <= 0:
                continue
            if add.get("trigger") == "conditions":
                hits = add_hits[rule][index]
                at = int(np.searchsorted(hits, bar, side="right"))
                if at >= len(hits):
                    continue
                hit_bar = int(hits[at])
                found.append(
                    (int(bars.first_minute[hit_bar]), float(market[hit_bar]), fraction, bool(add.get("moveStop")), index)
                )
                continue
            if add.get("r"):
                if not risk:
                    continue
                level = raw_entry + direction * float(add["r"]) * risk
            else:
                level = raw_entry * (1 + direction * float(add.get("pct") or 0) / 100)
            hit = _reach(minutes, minute + 1, plan[0] - 1, level, direction)
            if hit:
                found.append((hit[0], float(hit[1]), fraction, bool(add.get("moveStop")), index))
        found.sort(key=lambda item: item[0])

        done = []
        current_stop, stop_reason, moved_at = moved
        for add_minute, price, fraction, move, index in found:
            if add_minute >= plan[0]:
                break
            done.append((add_minute, price, fraction, index))
            if move and (current_stop is None or direction * (raw_entry - current_stop) > 0):
                current_stop, stop_reason = raw_entry, "break_even"
                moved_at = add_minute if moved_at is None else min(moved_at, add_minute)
                best = raw_entry
                extreme = best_until(direction, minute, add_minute)
                if extreme is not None:
                    best = max(best, extreme) if direction == 1 else min(best, extreme)
                plan = plan_exit(
                    rule, direction, bar, minute, raw_entry, current_stop, target, add_minute, best, stop_reason,
                    path,
                )
        # Uma saída que passou para mais cedo leva as parciais que ficavam depois dela
        partials = [part for part in partials if part[0] < plan[0] or (part[0] == plan[0] and plan[2] == "take_profit")]
        if moved_at is not None and moved_at >= plan[0]:
            moved_at = None
        return plan, partials, done, moved_at

    def add_to(position: Position, planned) -> None:
        """Um reforço chegou ao minuto dele: junta a fração da quantidade inicial ao
        preço com slippage (é uma ordem stop ou a mercado), até ao capital livre."""
        nonlocal margin_used
        add_minute, raw_price, fraction, index = planned
        position.adds_done += 1
        if position.closed or add_minute >= position.exit_minute:
            # Liquidada antes (ou no mesmo minuto): o preço já não chegou ao reforço
            add_stats[position.rule][index]["reached"] -= 1
            return
        take_deposits(int(minutes.time[add_minute]))
        price = slip(raw_price, position.direction == 1)
        leverage = float(leverages[position.rule] or 1)
        quantity = position.quantity * fraction
        free = capital - margin_used
        stats = add_stats[position.rule][index]
        reduced = quantity * price / leverage > free
        if reduced:
            quantity = max(free, 0.0) * leverage / price
        if step:
            quantity = math.floor(quantity / step + 1e-9) * step
        if quantity <= 0 or quantity < min_quantity or quantity * price < min_notional:
            # 4.9 sem capital livre (ou abaixo do mínimo da corretora) não entra
            stats["noCapital" if reduced else "rejectedMinimum"] += 1
            return
        stats["filled"] += 1
        stats["reduced"] += reduced
        margin = quantity * price / leverage
        margin_used += margin
        position.adds.append((add_minute, price, quantity, margin, raw_price, index))

    def funding_between(start_time: int, end_time: int, direction: int, quantity: float) -> float:
        """O funding das horas de funding entre dois instantes ]início, fim], com esta
        quantidade. Uma hora de funding T paga-se com a posição aberta em T: os tempos
        são o início do minuto e o que acontece nele (entrar, sair, mudar a quantidade)
        já é depois de T. Por isso quem entra no minuto T não paga o T e quem sai nele
        paga (a corretora vê a posição no instante T, antes da ordem)."""
        first = int(np.searchsorted(funding_times, start_time, side="right"))
        last = int(np.searchsorted(funding_times, end_time, side="right"))
        if last <= first:
            return 0.0
        prices = minutes.open[funding_minutes[first:last]]
        return float(direction * quantity * np.sum(prices * funding_rates[first:last]))

    def close_position(position: Position) -> None:
        nonlocal capital, margin_used, open_total, next_allowed_bar
        nonlocal sizing_adjust, sizing_left, streak_wins, streak_losses, paused_until
        nonlocal day_key, day_losses, day_pnl, day_capital
        direction = position.direction
        exit_price = slip(position.raw_exit, direction == -1) if position.exit_slipped else position.raw_exit
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
            funding_paid += funding_between(since, change_time, direction, held)
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
        funding_paid += funding_between(since, exit_time, direction, remaining)

        if position.exit_reason == "liquidation":
            # Perde-se o movimento até ao preço da liquidação e a margem de manutenção
            # (sem comissão de saída): na isolada é a margem do que resta; na cruzada,
            # todas juntas levam o capital
            fees = remaining * average * fee_entry + partial_fees
            pnl = (
                partial_pnl
                + direction * remaining * (position.raw_exit - average)
                - remaining * average * (maintenance + fee_entry)
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
        capital_before = capital
        pnl = max(pnl, -capital_before)  # não se perde mais do que se tem
        capital = capital_before + pnl
        margin = position.margin + sum(add[3] for add in position.adds)
        margin_used = max(margin_used - margin, 0.0)
        position.closed = True
        open_positions[:] = [item for item in open_positions if item is not position]
        open_total -= 1
        open_by_direction[direction] -= 1
        open_by_rule[position.rule] -= 1

        slippage_cost = (
            position.quantity * abs(position.entry_price - position.raw_entry)
            + sum(add[2] * abs(add[1] - add[4]) for add in position.adds)
            + remaining * abs(exit_price - position.raw_exit)
        )
        # Os depósitos que chegaram durante o trade
        take_deposits(exit_time)

        trades.append(
            Trade(
                entry_rule=position.rule + 1,
                side=entries[position.rule]["side"],
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
                equity=capital,
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
        account.closed_trade(position.rule, pnl, capital, exit_time)

        won = pnl > 0
        streak_wins, streak_losses = (streak_wins + 1, 0) if won else (0, streak_losses + 1)
        for rule in sizing_rules:
            streak = streak_losses if rule.get("after") == "losses" else streak_wins
            if streak != int(rule.get("count") or 0):
                continue
            action = rule.get("action")
            if action == "set":
                sizing_adjust = ("set", float(rule.get("value") or 0))
            elif action == "multiply":
                factor = float(rule.get("value") or 1)
                sizing_adjust = (sizing_adjust[0], sizing_adjust[1] * factor) if sizing_adjust else ("multiply", factor)
            else:
                sizing_adjust = None
            sizing_left = int(rule.get("trades") or 0) if action != "reset" else 0

        # As regras gerais: se uma se cumprir, pára as entradas durante a pausa
        history.append((exit_time, pnl, position.exit_reason, capital_before))
        for guard_index, guard in enumerate(guards):
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
                hit = streak_losses >= limit
            elif event == "lossAmount":
                hit = loss >= limit
            else:
                start_capital = recent[0][3]
                hit = start_capital > 0 and loss / start_capital * 100 >= limit
            if hit:
                until = max(paused_until, exit_time + _duration(guard.get("pause")))
                if journal is not None and until > paused_until:
                    journal.append({"kind": "pause", "time": exit_time, "until": until, "guard": guard_index + 1})
                paused_until = until

        day = clock.day(exit_time)
        if day != day_key:
            day_key, day_losses, day_pnl, day_capital = day, 0, 0.0, capital_before
        day_pnl += pnl
        day_losses = 0 if won else day_losses + 1

        exit_bar = bar_of(position.exit_minute)
        if position.exit_reason == "opposite":
            # A entrada que deu o sinal pode virar a posição já nesta vela
            closed_by_opposite[-direction] = exit_bar
        else:
            extra = cooldown if cooldown_any or not won else 0
            next_allowed_bar = max(next_allowed_bar, exit_bar + 1 + extra)

    # --- a liquidação -----------------------------------------------------
    # Vê-se à parte da saída planeada, que só pode cortar: entre duas mudanças (uma
    # posição que abre ou fecha, um reforço, uma parcial, um depósito) o preço de
    # liquidação é fixo, e procura-se minuto a minuto até à mudança seguinte. Na
    # isolada cada posição tem o seu (a margem do que tem, ao preço médio); na
    # cruzada é um só para a conta: o capital, o lucro já realizado nas parciais e
    # o flutuante de todas as posições contra a manutenção de todas, por isso o
    # capital não conta duas vezes e as perdas de uma tiram margem às outras.

    def holding(position: Position, until: int) -> tuple[float, float, float]:
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

    def watched(key: Position | None) -> list[Position]:
        """As posições de uma vigia: a própria (isolada) ou todas as com alavancagem (cruzada)."""
        if key is not None:
            return [] if key.closed else [key]
        return [item for item in open_positions if leverages[item.rule] is not None]

    def liquidation_level(members: list[Position], now: int) -> tuple[float, bool] | None:
        """O preço de liquidação agora e se se chega lá a descer (True) ou a subir; None se não há."""
        if cross:
            take_deposits(int(minutes.time[now]))
            # As posições sem alavancagem só prendem a margem delas
            equity = capital - sum(
                item.margin + sum(add[3] for add in item.adds)
                for item in open_positions if leverages[item.rule] is None
            )
            net = signed = kept = 0.0
            for item in members:
                held, cost, realized = holding(item, now)
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
            held, cost, _ = holding(item, now)
            if held <= 0:
                return None
            # A margem do que tem (o custo ÷ a alavancagem) menos a manutenção
            level = cost / held * (1 - item.direction * (1 / float(leverages[item.rule]) - maintenance))
            falling = item.direction == 1
        return (level, falling) if level > 0 else None

    def next_change(members: list[Position], now: int) -> int:
        """O minuto da próxima mudança das posições da vigia: a saída planeada de uma,
        um reforço e, na cruzada, uma parcial ou um depósito."""
        changes = []
        for item in members:
            changes.append(item.exit_minute)
            if item.adds_done < len(item.planned_adds):
                changes.append(item.planned_adds[item.adds_done][0])
            if cross:
                changes += [m for m, _, _ in item.partials if m > now][:1]
        if cross and paid < len(deposits):
            deposit = int(np.searchsorted(minutes.time, deposits[paid], side="left"))
            if now < deposit < len(minutes):
                changes.append(deposit)
        return min(changes)

    def first_cross(start: int, end: int, level: float, falling: bool) -> int | None:
        """O primeiro minuto de `start` a `end` (inclusive) em que o preço chega ao nível."""
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

    def watch(key: Position | None, now: int, again: bool = True) -> None:
        """Vigia a liquidação a partir do minuto `now` (`key`: a posição, na isolada;
        None, a conta, na cruzada). As vigias antigas desta chave deixam de contar.
        Com uma mudança ainda por ver neste minuto (um reforço, uma saída), volta-se
        a ver no fim dele (`again`; a vigia que já é isso não volta)."""
        nonlocal cross_watch
        if key is None:
            cross_watch += 1
            generation = cross_watch
        else:
            key.watch += 1
            generation = key.watch
        members = watched(key)
        if not members:
            return
        found = liquidation_level(members, now)
        boundary = next_change(members, now)
        if found is not None:
            minute = first_cross(now, boundary, *found)
            if minute is not None:
                push(minute, LIQUIDATE, (key, generation, found[0]))
                return
        # (na isolada, a saída da própria posição já é o fim da vigia)
        if (boundary > now or again) and (key is None or boundary < key.exit_minute):
            push(boundary, RECHECK, (key, generation))

    def watching(key: Position | None, generation: int) -> bool:
        """Se a vigia ainda é a atual (uma mudança depois dela fez outra)."""
        return generation == (cross_watch if key is None else key.watch)

    def liquidate(key: Position | None, minute: int, level: float) -> None:
        """O preço chegou à liquidação neste minuto. Uma posição cujo stop bate nele
        antes de o preço lá chegar sai pelo stop (como no `_find_stop`); as outras
        fecham ao preço da liquidação. Na cruzada, sem as que saíram, vê-se outra vez."""
        members = watched(key)
        for item in members:
            if (
                item.exit_minute == minute
                and item.exit_reason in ("stop_loss", "trailing_stop", "break_even")
                and item.direction * (item.raw_exit - level) > 0
            ):
                close_position(item)
        rest = [item for item in members if not item.closed]
        if cross and len(rest) < len(members):
            found = liquidation_level(rest, minute) if rest else None
            if found is None or first_cross(minute, minute, *found) is None:
                watch(key, minute)
                return
            level = found[0]
        for item in rest:
            item.exit_minute, item.raw_exit, item.exit_reason = minute, level, "liquidation"
            item.exit_rule, item.exit_slipped = None, False
            item.partials = [part for part in item.partials if part[0] < minute]
            if item.path is not None:
                item.stop_rules_fired = item.path.fired_until(bar_of(minute))
            if not lite or live is not None:
                item.stop_moves = stop_history(item, item.path, item.moved_at)
            close_position(item)
        if cross:
            watch(None, minute)

    def blocked_today(bar: int) -> bool:
        # Sem limites do dia não há que saber o dia (é a cada sinal)
        if day_key is None or not (max_day_losses or max_day_loss):
            return False
        if clock.day(int(bars.time[bar])) != day_key:
            return False
        if max_day_losses and day_losses >= max_day_losses:
            return True
        return bool(max_day_loss and day_pnl <= -day_capital * max_day_loss)

    def place(bar: int, rule: int) -> None:
        """Uma entrada deu sinal na vela `bar`: põe a ordem, se puder."""
        direction = directions[rule]
        funnel["signals"] += 1
        signals_by_rule[rule] += 1
        if bar < next_allowed_bar:
            funnel["blockedCooldown"] += 1
            return
        if blocked[bar] or (entry_allowed[rule] is not None and not entry_allowed[rule][bar]):
            funnel["blockedSchedule"] += 1
            return
        if bar <= pending_until[rule]:
            funnel["blockedPyramid"] += 1
            return
        if blocked_today(bar):
            funnel["blockedDaily"] += 1
            return
        if bars.time[bar] < paused_until:
            funnel["blockedGuards"] += 1
            return
        stopped_by = account.blocking(rule, int(bars.time[bar]), open_total, open_by_rule)
        if stopped_by is not None:
            funnel["blockedContext"] += 1
            context_blocks[rule][stopped_by] += 1
            return
        if opposite == "close" and closed_by_opposite[direction] == bar:
            funnel["blockedOpposite"] += 1
            return
        order = entry_orders[rule]
        # Com uma posição contrária: num nível, ao fechar/virar, ela pode sair no
        # minuto em que a ordem entra (vê-se nesse minuto)
        if open_by_direction[-direction] and opposite != "hedge":
            if order.market or opposite == "ignore":
                funnel["blockedOpposite"] += 1
                return
        if open_by_rule[rule] + pending_by_rule[rule] >= rule_limit[rule]:
            funnel["blockedPyramid"] += 1
            return
        if open_total + sum(pending_by_rule) >= max_positions:
            funnel["blockedMaxPositions"] += 1
            return
        take_deposits(int(bars.time[bar]))
        if capital - margin_used <= 0:
            funnel["noCapital"] += 1
            return

        if order.market:
            minute = int(bars.first_minute[bar])
            open_position(rule, bar, minute, float(market[bar]), None)
            return

        # Uma ordem a um nível: procura-se a vela em que o preço lá chega
        last_bar = min(bar + validity[rule], len(bars)) - 1
        fill = None
        level = float(order.level[bar])
        rising = not math.isnan(level) and level >= bars.open[bar]
        entry = entries[rule]
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
            fill = _touch(bars, minutes, current, level, rising, allowed=fill_masks[rule])
            if fill:
                last_bar = current
                break

        funnel["ordersPlaced"] += 1
        order_stats["placed"][rule] += 1
        pending_by_rule[rule] += 1
        pending_until[rule] = last_bar
        if fill:
            push(fill[0], FILL, (rule, bar, fill))
        else:
            expires = int(bars.first_minute[last_bar + 1]) if last_bar + 1 < len(bars) else len(minutes)
            push(expires, EXPIRE, (rule, cancelled))

    # --- o ciclo ----------------------------------------------------------
    span = len(bars) - first_bar
    expected = 0 if lite else _variants_expected(strategy, entries)

    def main_progress(fraction: float) -> None:
        if lite:
            on_progress(fraction)
            return
        # Com relatório, o ciclo é só a primeira parte da barra; o fim prevê-se
        # com o que falta dele e as variantes, cada uma como ele inteiro
        elapsed = time.monotonic() - started
        whole = elapsed / fraction if fraction > 0 else None
        on_progress(fraction * MAIN_SHARE, {
            "phase": "simulating",
            "bars": span,
            "variantsTotal": expected,
            "estimatedEndAt": int((time.time() + whole * (1 - fraction) + whole * expected) * 1000) if whole else None,
        })
    cursor = 0
    total = len(candidate_bars)
    while True:
        next_minute = int(bars.first_minute[candidate_bars[cursor]]) if cursor < total else None
        if events and (next_minute is None or events[0][0] <= next_minute):
            minute, kind, _, payload = heapq.heappop(events)
            if kind == LIQUIDATE:
                key, generation, level = payload
                if watching(key, generation):
                    liquidate(key, minute, level)
            elif kind == RECHECK:
                key, generation = payload
                if watching(key, generation):
                    watch(key, minute, again=False)
            elif kind == EXIT:
                if payload.closed:  # já liquidada
                    continue
                # Ao vivo, a que chega ao fim das velas continua aberta
                if journal is not None and payload.exit_reason == "end":
                    still_open.append(payload)
                    continue
                close_position(payload)
            elif kind == ADD:
                add_to(*payload)
            elif kind == EXPIRE:
                rule, cancelled = payload
                # Ao vivo, uma ordem que vale para lá das velas continua à espera
                if journal is not None and minute >= len(minutes):
                    still_pending.append(rule)
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
                closed_here = opposite == "close" and closed_by_opposite[directions[rule]] == bar_of(fill_minute)
                if not closed_here and not _in_periods(int(minutes.time[fill_minute]), period_index) and can_hold(rule):
                    opened = open_position(rule, bar, fill_minute, price, rising)
                    order_stats["filled" if opened else "expired"][rule] += 1
                else:
                    # O preço chegou lá, mas a posição já não podia abrir: a ordem cai
                    opened = False
                    funnel["ordersExpired"] += 1
                    order_stats["expired"][rule] += 1
                if journal is not None:
                    journal.append({
                        "kind": "filled" if opened else "fillFailed", "minute": fill_minute, "rule": rule,
                        "price": float(price), "reason": None if opened else outcome(before),
                    })
            continue
        if next_minute is None:
            break
        # Sem capital, sem posições e sem depósitos para vir, já não entra nada
        if capital <= 0 and not open_total and paid >= len(deposits):
            # Os sinais que ainda faltavam também contam, sem capital
            funnel["signals"] += total - cursor
            for rule, count in enumerate(np.bincount(candidate_rules[cursor:], minlength=len(entries))):
                signals_by_rule[rule] += int(count)
            funnel["noCapital"] += total - cursor
            break

        bar, rule = int(candidate_bars[cursor]), int(candidate_rules[cursor])
        cursor += 1
        if cursor % 256 == 0:
            main_progress((bar - first_bar) / span)
        if journal is None:
            place(bar, rule)
        else:
            before = dict(funnel)
            place(bar, rule)
            journal.append({"kind": "signal", "bar": bar, "rule": rule, "outcome": outcome(before)})

    # Os depósitos continuam a entrar até ao fim, mesmo sem trades
    take_deposits(end_ms)
    deposited = float(deposit_amounts.sum())

    main_progress(1.0)
    summary = summarize(trades, initial, capital, bars, first_bar, entries, deposited)
    summary.update(
        totalFunding=sum(trade.funding for trade in trades),
        skippedOrders=skipped,
        maxOpenPositions=most_open,
        inBase=_in_base(initial, capital, deposits, deposit_amounts, bars, first_bar, minutes),
    )
    if live is not None:
        live.update(
            open=still_open,
            pending=still_pending,
            journal=journal,
            deposits=[(int(when), float(amount)) for when, amount in zip(deposits[:paid], deposit_amounts[:paid])],
            capital=capital,
            marginUsed=margin_used,
            pausedUntil=paused_until,
            setup=[order.setup_events for order in entry_orders],
            chart=chart,
            first_bar=first_bar,
        )
    if lite:
        drawdown = factsheet.max_drawdown(trades, initial, deposits, deposit_amounts, minutes, start_ms, end_ms)
        if progress.current is not None:
            progress.current.variant()
        return trades, summary, {
            "orderStats": order_stats, "maxDrawdownPct": drawdown, "funnel": funnel, "addStats": add_stats,
        }
    progress.current = ReportProgress(
        on_progress, expected, time.monotonic() - started, {"bars": span, "trades": len(trades)}
    )
    progress.current.emit()
    # Aqui e não no topo: o relatório corre a simulação outra vez (as variantes)
    from .report.build import _report

    # 2.2 e 4.9 as regras da entrada: a preparação (só os acontecimentos do período), as
    # condições da conta e os reforços
    rule_stats = {
        "setup": [_setup_events(order.setup_events, first_bar) for order in entry_orders],
        "context": context_blocks,
        "adds": add_stats,
    }
    try:
        return _report(
            bars, first_bar, minutes, strategy, start_ms, end_ms, timeframe, funding, trades, summary, initial,
            capital, deposits, deposit_amounts, most_open, fee_entry, entries, order_stats, funnel, signals_by_rule,
            clock, funding_times, funding_rates, funding_minutes, rule_stats, chart,
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

"""Como sai cada posição, calculado ao abrir: a primeira saída que acontecer
(stop, take profit, saídas com condição, sinal contrário, tempo, período
excluído ou o fim), as saídas parciais, os reforços e por onde andou o stop."""

import math

import numpy as np

from .execution import _fill, _find_stop, _reach, _slipped
from .models import Position


class PlanningMixin:
    """Os planos de saída (métodos da simulação; o estado está no `Prepared`)."""

    def plan_exit(
        self, rule: int, direction: int, entry_bar: int, entry_minute: int, raw_entry: float, stop, target,
        start: int | None = None, best: float | None = None, stop_reason: str = "stop_loss", path=None,
    ):
        """Como e quando sai a posição: a primeira saída que acontecer. Depois de
        uma saída parcial volta-se a ver a partir dela (`start`), com o melhor preço
        até lá e o stop que tiver nessa altura. `path` é o stop movido pelos ajustes.
        A liquidação não entra aqui: vê-se à parte (`watch`), porque depende do
        tamanho, do preço médio e, na margem cruzada, das outras posições."""
        entry = self.entries[rule]
        bars, minutes, market = self.bars, self.minutes, self.market

        # A saída com condição que acontece primeiro: (minuto, preço, saída, sentido, motivo)
        signal = None
        signal_bar = None
        for exit_index, order in enumerate(self.exit_orders[rule]):
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
        if self.opposite in ("close", "reverse"):
            signal_bars, signal_rules = self.opposite_signals[direction]
            position = int(np.searchsorted(signal_bars, entry_bar, side="right"))
            if position < len(signal_bars):
                hit_bar = int(signal_bars[position])
                fill = _fill(self.entry_orders[int(signal_rules[position])], bars, minutes, hit_bar, market)
                if fill and (signal is None or fill[0] < signal[0]):
                    signal = (fill[0], fill[1], None, fill[2], "opposite")

        # Ao fim de N velas sai ao mercado (numa vela parada, na primeira com minutos a seguir)
        real_bars = self.real_bars
        max_bars = int(entry.get("maxBars") or 0)
        at = int(np.searchsorted(real_bars, entry_bar + max_bars)) if max_bars else len(real_bars)
        if at < len(real_bars):
            time_bar = int(real_bars[at])
            minute = int(bars.first_minute[time_bar])
            if signal is None or minute < signal[0]:
                signal = (minute, float(market[time_bar]), None, None, "time")

        # O início de um período excluído fecha-a à força
        forced = self.forced
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
            self.minute_mask(entry.get("stopLossSchedule")),
            self.minute_mask(entry.get("takeProfitSchedule")),
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

    def best_until(self, direction: int, start: int, until: int) -> float | None:
        """O melhor preço de `start` até antes de `until` (o trailing continua dele)."""
        if until <= start:
            return None
        span = slice(start, until)
        minutes = self.minutes
        return float(minutes.high[span].max() if direction == 1 else minutes.low[span].min())

    def stop_history(self, position: Position, path, moved_at: int | None) -> list | None:
        """Por onde andou o stop até à saída (para o gráfico): [{time, level}] a
        cada mudança, a começar no da entrada. Contam os ajustes (vela a vela) e
        a passagem à entrada por uma parcial ou um reforço; o trailing e o
        break-even da entrada mexem minuto a minuto e ficam de fora. None se o
        stop nunca mexeu."""
        bars, minutes = self.bars, self.minutes
        long = position.direction == 1
        nothing = -math.inf if long else math.inf
        fixed = position.stop_level if position.stop_level is not None else nothing
        changes = []  # (minuto, nível dos ajustes ou None, passou à entrada)
        if path is not None:
            for bar, level in zip(*path.levels_until(self.bar_of(position.exit_minute))):
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

    def plan_partials(self, rule, direction, bar, minute, raw_entry, stop, target, plan, path, quantity):
        """As saídas parciais, da mais perto à mais longe: cada uma acontece se o
        preço lá chegar antes da saída final (no mesmo minuto, só antes do take; o
        stop ganha). Uma que passe o stop para a entrada muda a saída final, que se
        volta a procurar a partir dela. Devolve a saída final e as parciais
        (minuto, preço, fração da quantidade inicial) e o stop, o motivo com que ficou
        e o minuto em que passou à entrada (None se não passou)."""
        parts = self.entries[rule].get("partialExits") or []
        if not parts:
            return plan, [], (stop, "stop_loss", None)
        minutes, step, min_quantity, min_notional = self.minutes, self.step, self.min_quantity, self.min_notional
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
            extreme = self.best_until(direction, minute, hit[0])
            if extreme is not None:
                best = max(best, extreme) if direction == 1 else min(best, extreme)
            start = hit[0]
            plan = self.plan_exit(
                rule, direction, bar, minute, raw_entry, current_stop, target, start, best, stop_reason, path,
            )
        return plan, done, (current_stop, stop_reason, moved_at)

    def plan_adds(self, rule, direction, bar, minute, raw_entry, stop, target, plan, path, partials, moved):
        """Os reforços: juntam uma fração da quantidade inicial quando o preço anda a
        favor X R ou X % (ao nível, como uma ordem stop) ou na abertura da primeira vela
        depois da entrada em que as condições se cumprem (ao mercado). Cada um uma vez,
        antes da saída final; um que passe o stop para a entrada volta a procurar a
        saída a partir dele (as parciais depois da saída nova caem). Devolve a saída,
        as parciais, os reforços (minuto, preço sem slippage, fração, n.º do reforço)
        e o minuto em que o stop passou à entrada (None se não passou)."""
        config = self.entries[rule].get("scaleIns") or []
        if not config:
            return plan, partials, [], moved[2]
        bars, minutes, market = self.bars, self.minutes, self.market
        risk = abs(raw_entry - stop) if stop is not None else None
        found = []
        for index, add in enumerate(config):
            fraction = float(add.get("sizePct") or 0) / 100
            if fraction <= 0:
                continue
            if add.get("trigger") == "conditions":
                hits = self.add_hits[rule][index]
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
                extreme = self.best_until(direction, minute, add_minute)
                if extreme is not None:
                    best = max(best, extreme) if direction == 1 else min(best, extreme)
                plan = self.plan_exit(
                    rule, direction, bar, minute, raw_entry, current_stop, target, add_minute, best, stop_reason,
                    path,
                )
        # Uma saída que passou para mais cedo leva as parciais que ficavam depois dela
        partials = [part for part in partials if part[0] < plan[0] or (part[0] == plan[0] and plan[2] == "take_profit")]
        if moved_at is not None and moved_at >= plan[0]:
            moved_at = None
        return plan, partials, done, moved_at

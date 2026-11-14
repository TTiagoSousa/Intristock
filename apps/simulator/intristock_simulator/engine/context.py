"""As condições da conta de uma entrada (`context`, "só entra se"): o resultado
do último trade, as séries de ganhos ou perdas, as posições abertas e os trades
de hoje (de todas as entradas ou só desta), o P&L de hoje em % e a distância ao
máximo do capital. Não vêm das velas: veem-se no motor, no momento do sinal."""

from .clock import Clock

_COMPARE = {
    "gt": lambda a, b: a > b,
    "gte": lambda a, b: a >= b,
    "lt": lambda a, b: a < b,
    "lte": lambda a, b: a <= b,
    "eq": lambda a, b: a == b,
}


class AccountContext:
    def __init__(self, entries: list[dict], initial: float, clock: Clock):
        self.rules = [entry.get("context") or [] for entry in entries]
        self.clock = clock
        count = len(entries)
        self.last = [None] * count  # o último resultado de cada entrada ("win" | "loss")
        self.last_all = None
        self.wins, self.losses = [0] * count, [0] * count  # as séries de cada entrada
        self.wins_all = self.losses_all = 0
        self.day = None  # o dia local dos contadores de hoje
        self.opened, self.opened_all = [0] * count, 0  # trades abertos hoje
        self.day_pnl, self.day_capital = 0.0, initial  # o P&L fechado hoje e o capital no início do dia
        self.capital, self.peak = initial, initial

    @property
    def active(self) -> bool:
        return any(self.rules)

    def _today(self, time_ms: int) -> None:
        day = self.clock.day(time_ms)
        if day != self.day:
            self.day = day
            self.opened, self.opened_all = [0] * len(self.opened), 0
            self.day_pnl, self.day_capital = 0.0, self.capital

    def opened_trade(self, rule: int, time_ms: int) -> None:
        self._today(time_ms)
        self.opened[rule] += 1
        self.opened_all += 1

    def closed_trade(self, rule: int, pnl: float, capital: float, time_ms: int) -> None:
        self._today(time_ms)
        result = "win" if pnl > 0 else "loss"
        self.last[rule] = self.last_all = result
        if result == "win":
            self.wins[rule], self.losses[rule] = self.wins[rule] + 1, 0
            self.wins_all, self.losses_all = self.wins_all + 1, 0
        else:
            self.wins[rule], self.losses[rule] = 0, self.losses[rule] + 1
            self.wins_all, self.losses_all = 0, self.losses_all + 1
        self.day_pnl += pnl
        self.capital = capital
        self.peak = max(self.peak, capital)

    def blocking(self, rule: int, time_ms: int, open_total: int, open_by_rule: list[int]) -> int | None:
        """A primeira condição da conta desta entrada que não se cumpre agora (o
        índice), ou None se todas se cumprem."""
        if not self.rules[rule]:
            return None
        self._today(time_ms)
        for index, item in enumerate(self.rules[rule]):
            own = item.get("scope") == "self"
            kind = item.get("kind")
            if kind == "lastTrade":
                # Antes do primeiro trade não há último: não trava (senão nunca entrava)
                last = self.last[rule] if own else self.last_all
                if last is not None and last != item.get("result"):
                    return index
                continue
            if kind == "winStreak":
                value = self.wins[rule] if own else self.wins_all
            elif kind == "lossStreak":
                value = self.losses[rule] if own else self.losses_all
            elif kind == "openPositions":
                value = open_by_rule[rule] if own else open_total
            elif kind == "tradesToday":
                value = self.opened[rule] if own else self.opened_all
            elif kind == "dayPnlPct":
                value = self.day_pnl / self.day_capital * 100 if self.day_capital > 0 else 0.0
            elif kind == "drawdownPct":
                value = (self.peak - self.capital) / self.peak * 100 if self.peak > 0 else 0.0
            else:
                continue
            compare = _COMPARE.get(item.get("operator") or "gte")
            if not compare(value, float(item.get("value") or 0)):
                return index
        return None

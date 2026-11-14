"""As velas da simulação e as de outros tempos gráficos."""

from ..market.candles import Bars, Candles, to_bars


class Chart:
    """As velas da simulação e, quando uma condição as pede, as de outros
    tempos gráficos, feitas dos mesmos minutos (uma vez por tempo gráfico). Com o
    relógio da estratégia (`clock`), também os níveis do dia e da semana."""

    def __init__(self, bars: Bars, minutes: Candles, timeframe: str | None = None, clock=None):
        self.bars = bars
        self.minutes = minutes
        self.timeframe = timeframe
        self.clock = clock
        self._others: dict[str, Bars] = {}
        # Os níveis do dia e da semana já feitos (strategy.sessions)
        self.sessions: dict = {}

    def __len__(self) -> int:
        return len(self.bars)

    def bars_of(self, timeframe: str | None) -> Bars:
        if not timeframe or timeframe == self.timeframe:
            return self.bars
        if timeframe not in self._others:
            self._others[timeframe] = to_bars(self.minutes, timeframe)
        return self._others[timeframe]

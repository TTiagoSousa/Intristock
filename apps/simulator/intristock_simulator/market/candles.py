"""Velas do ClickHouse, já em arrays do numpy.

Vêm sempre as de 1 minuto. As do timeframe da simulação fazem-se a partir delas
aqui (e não noutra query), e as de 1 minuto ficam para ver, minuto a minuto, o
que bateu primeiro: o stop ou o take profit.

As leituras vêm direto para o numpy (`query_np` do clickhouse-connect, as
colunas de cada bloco já em arrays), sem passar milhões de valores por listas de
Python.
"""

from dataclasses import dataclass
from datetime import datetime

import numpy as np
from clickhouse_connect.driver.client import Client

MINUTE_MS = 60_000

TIMEFRAME_MINUTES = {
    "1m": 1,
    "3m": 3,
    "5m": 5,
    "15m": 15,
    "30m": 30,
    "1h": 60,
    "4h": 240,
    "1d": 1440,
}


@dataclass
class Candles:
    # Início de cada vela, em ms UTC
    time: np.ndarray
    open: np.ndarray
    high: np.ndarray
    low: np.ndarray
    close: np.ndarray
    volume: np.ndarray

    def __len__(self) -> int:
        return len(self.time)


@dataclass
class Bars(Candles):
    # Índice do primeiro minuto de cada vela no array dos minutos
    first_minute: np.ndarray


def _columns(rows: np.ndarray, names: tuple[str, ...], dtypes: tuple) -> list[np.ndarray] | None:
    """As colunas de um resultado do `query_np`, cada uma num array contíguo. Com
    tipos diferentes vem um array estruturado (uma coluna por nome); com todos
    iguais, um 2D (uma coluna por posição). Nulo sem linhas."""
    if rows.size == 0:
        return None
    if rows.dtype.names:
        return [np.ascontiguousarray(rows[name], dtype=dtype) for name, dtype in zip(names, dtypes)]
    return [np.ascontiguousarray(rows[:, index], dtype=dtype) for index, dtype in enumerate(dtypes)]


_MINUTE_COLUMNS = ("t", "o", "h", "l", "c", "v")
_MINUTE_TYPES = (np.int64, np.float64, np.float64, np.float64, np.float64, np.float64)


def load_minutes(client: Client, instrument_id: str, start: datetime, end: datetime) -> Candles:
    rows = client.query_np(
        """
        SELECT toUnixTimestamp64Milli(open_time) AS t, open AS o, high AS h, low AS l, close AS c, volume AS v
          FROM market_candles FINAL
         WHERE instrument_id = {instrument:UUID}
           AND open_time >= {start:DateTime64(3, 'UTC')}
           AND open_time < {end:DateTime64(3, 'UTC')}
         ORDER BY open_time
        """,
        parameters={"instrument": instrument_id, "start": start, "end": end},
    )
    columns = _columns(rows, _MINUTE_COLUMNS, _MINUTE_TYPES)
    if columns is None:
        empty = np.array([], dtype=np.float64)
        return Candles(np.array([], dtype=np.int64), empty, empty, empty, empty, empty)
    return Candles(*columns)


def load_funding(client: Client, instrument_id: str, start: datetime, end: datetime):
    """As taxas de funding (horas em ms e taxas em fração) de um perpétuo."""
    rows = client.query_np(
        """
        SELECT toUnixTimestamp64Milli(funding_time) AS t, rate AS r
          FROM market_funding FINAL
         WHERE instrument_id = {instrument:UUID}
           AND funding_time >= {start:DateTime64(3, 'UTC')}
           AND funding_time < {end:DateTime64(3, 'UTC')}
         ORDER BY funding_time
        """,
        parameters={"instrument": instrument_id, "start": start, "end": end},
    )
    columns = _columns(rows, ("t", "r"), (np.int64, np.float64))
    if columns is None:
        return np.array([], dtype=np.int64), np.array([], dtype=np.float64)
    return columns[0], columns[1]


def to_bars(minutes: Candles, timeframe: str) -> Bars:
    """Junta os minutos em velas do timeframe, alinhadas a UTC (as de 4 h às
    00, 04, 08…; as diárias à meia-noite), como na Binance.

    Os períodos sem minutos entre a primeira e a última vela (na Coinbase, sem
    negócios não há vela) ficam com uma vela parada, como a Binance as dá: tudo
    no fecho anterior e volume 0. Assim "há N velas" é sempre N períodos. Uma
    vela parada não tem minutos: o `first_minute` dela é o da vela seguinte
    (`empty_bars` diz quais são)."""
    if len(minutes) == 0:
        empty = np.array([], dtype=np.float64)
        index = np.array([], dtype=np.int64)
        return Bars(index, empty, empty, empty, empty, empty, index)

    size = TIMEFRAME_MINUTES[timeframe] * MINUTE_MS
    bucket = minutes.time // size * size
    # Os minutos vêm ordenados: uma vela começa onde o balde muda
    first = np.flatnonzero(np.r_[True, bucket[1:] != bucket[:-1]])
    last = np.r_[first[1:], len(minutes)] - 1
    starts = bucket[first]
    opens = minutes.open[first]
    highs = np.maximum.reduceat(minutes.high, first)
    lows = np.minimum.reduceat(minutes.low, first)
    closes = minutes.close[last]
    volumes = np.add.reduceat(minutes.volume, first)

    count = int((starts[-1] - starts[0]) // size) + 1
    if count == len(first):
        return Bars(time=starts, open=opens, high=highs, low=lows, close=closes, volume=volumes, first_minute=first)

    # Com buracos: a grelha toda, e as velas paradas no fecho da anterior
    at = (starts - starts[0]) // size
    real = np.zeros(count, bool)
    real[at] = True
    previous = np.maximum.accumulate(np.where(real, np.arange(count), 0))  # a última vela com minutos
    filled_close = np.empty(count)
    filled_close[at] = closes
    filled_close = filled_close[previous]

    def spread(values):
        result = filled_close.copy()
        result[at] = values
        return result

    # O primeiro minuto de uma vela parada é o da vela com minutos seguinte (a última tem-nos sempre)
    first_minute = np.full(count, len(minutes), np.int64)
    first_minute[at] = first
    first_minute = np.minimum.accumulate(first_minute[::-1])[::-1]
    volume = np.zeros(count)
    volume[at] = volumes
    return Bars(
        time=starts[0] + np.arange(count, dtype=np.int64) * size,
        open=spread(opens),
        high=spread(highs),
        low=spread(lows),
        close=filled_close,
        volume=volume,
        first_minute=first_minute,
    )


def empty_bars(bars: Bars, total_minutes: int) -> np.ndarray:
    """As velas sem minutos (as paradas que o `to_bars` pôs nos buracos)."""
    return np.diff(np.r_[bars.first_minute, total_minutes]) == 0

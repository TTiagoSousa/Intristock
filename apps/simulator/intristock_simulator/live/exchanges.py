"""As corretoras ao vivo: as velas de 1 minuto que faltam (REST, sem chave) e o
WebSocket com a vela do minuto a formar-se.

A Binance (spot e futuros USDⓈ-M) dá a vela de 1 minuto pronta (`@kline_1m`), a
cada negócio. A Coinbase Exchange só dá os negócios (`matches`): a vela faz-se
aqui, e um minuto sem negócios não tem vela (como no REST e no downloader).
"""

from __future__ import annotations

import asyncio
import json
import logging
import time
import urllib.error
import urllib.parse
import urllib.request
from collections.abc import AsyncIterator
from dataclasses import dataclass
from datetime import datetime, timezone

import websockets

log = logging.getLogger(__name__)

MINUTE_MS = 60_000

BINANCE_KLINES = {
    "spot": ("https://api.binance.com/api/v3/klines", 1000),
    "futures": ("https://fapi.binance.com/fapi/v1/klines", 1000),
}
BINANCE_STREAMS = {
    "spot": "wss://stream.binance.com:9443/ws/{symbol}@kline_1m",
    # Os futuros passaram os streams de mercado para /market (o /ws antigo liga-se e fica calado)
    "futures": "wss://fstream.binance.com/market/ws/{symbol}@kline_1m",
}
# Sem nenhuma mensagem durante este tempo, a ligação conta como morta e volta-se a ligar
# (a Binance manda a vela várias vezes por segundo; a Coinbase o heartbeat de segundo a segundo)
SILENCE_SECONDS = 60
BINANCE_FUNDING = "https://fapi.binance.com/fapi/v1/fundingRate"
COINBASE_CANDLES = "https://api.exchange.coinbase.com/products/{symbol}/candles"
COINBASE_STREAM = "wss://ws-feed.exchange.coinbase.com"
COINBASE_PAGE = 300
# A Coinbase aguenta ~10 pedidos por segundo: fica-se abaixo
COINBASE_INTERVAL_S = 0.15
RETRIES = 5
USER_AGENT = "IntriStock"


@dataclass
class Instrument:
    id: str
    source: str  # binance | coinbase
    type: str  # spot | perpetual | future
    symbol: str

    @property
    def market(self) -> str:
        return "spot" if self.type == "spot" else "futures"

    @property
    def key(self) -> str:
        return f"{self.source}:{self.market}:{self.symbol}"


@dataclass
class Minute:
    """Uma vela de 1 minuto (`time` = início, ms UTC)."""

    time: int
    open: float
    high: float
    low: float
    close: float
    volume: float


def _get_json(url: str, params: dict) -> object:
    query = urllib.parse.urlencode(params)
    request = urllib.request.Request(f"{url}?{query}", headers={"User-Agent": USER_AGENT})
    for attempt in range(RETRIES):
        try:
            with urllib.request.urlopen(request, timeout=30) as response:
                return json.loads(response.read())
        except urllib.error.HTTPError as error:
            # Demasiados pedidos ou erro do lado deles: espera e tenta outra vez
            if error.code in (418, 429) or error.code >= 500:
                delay = int(error.headers.get("Retry-After") or 1 + attempt * 2)
                log.warning("%s respondeu HTTP %s, à espera %ss", url, error.code, delay)
                time.sleep(delay)
                continue
            raise
        except (urllib.error.URLError, TimeoutError) as error:
            delay = 1 + attempt * 2
            log.warning("%s sem resposta (%s), à espera %ss", url, error, delay)
            time.sleep(delay)
    raise RuntimeError(f"{url} não respondeu depois de {RETRIES} tentativas")


def _iso(seconds: int) -> str:
    return datetime.fromtimestamp(seconds, tz=timezone.utc).isoformat().replace("+00:00", "Z")


def fetch_minutes(instrument: Instrument, start_ms: int, end_ms: int) -> list[Minute]:
    """As velas de 1 minuto já fechadas com início em [start_ms, end_ms[."""
    if instrument.source == "coinbase":
        return _coinbase_minutes(instrument.symbol, start_ms, end_ms)
    url, page_size = BINANCE_KLINES[instrument.market]
    minutes: list[Minute] = []
    cursor = start_ms
    while cursor < end_ms:
        page = _get_json(
            url,
            {"symbol": instrument.symbol, "interval": "1m", "startTime": cursor, "endTime": end_ms - 1, "limit": page_size},
        )
        if not page:
            break
        for kline in page:
            open_ms = int(kline[0])
            if open_ms >= end_ms:
                break
            minutes.append(Minute(open_ms, float(kline[1]), float(kline[2]), float(kline[3]), float(kline[4]), float(kline[5])))
        cursor = int(page[-1][0]) + MINUTE_MS
        if len(page) < page_size:
            break
    return minutes


def _coinbase_minutes(symbol: str, start_ms: int, end_ms: int) -> list[Minute]:
    rows: dict[int, Minute] = {}
    cursor = start_ms // 1000
    end_s = end_ms // 1000
    url = COINBASE_CANDLES.format(symbol=symbol)
    while cursor < end_s:
        window_end = min(cursor + COINBASE_PAGE * 60, end_s)
        page = _get_json(url, {"granularity": 60, "start": _iso(cursor), "end": _iso(window_end - 60)})
        # [início s, mínima, máxima, abertura, fecho, volume], das mais recentes para as mais antigas
        for start, low, high, open_, close, volume in page:
            start = int(start)
            if cursor <= start < window_end:
                rows[start] = Minute(start * 1000, float(open_), float(high), float(low), float(close), float(volume))
        cursor = window_end
        time.sleep(COINBASE_INTERVAL_S)
    return [rows[key] for key in sorted(rows)]


def fetch_funding(instrument: Instrument, start_ms: int, end_ms: int) -> tuple[list[int], list[float]]:
    """As taxas de funding de um perpétuo da Binance (hora em ms, taxa em fração)."""
    times: list[int] = []
    rates: list[float] = []
    if instrument.source != "binance" or instrument.type != "perpetual":
        return times, rates
    cursor = start_ms
    while cursor < end_ms:
        page = _get_json(BINANCE_FUNDING, {"symbol": instrument.symbol, "startTime": cursor, "endTime": end_ms - 1, "limit": 1000})
        if not page:
            break
        for row in page:
            times.append(int(row["fundingTime"]))
            rates.append(float(row["fundingRate"]))
        cursor = int(page[-1]["fundingTime"]) + 1
        if len(page) < 1000:
            break
    return times, rates


async def stream_minutes(instrument: Instrument) -> AsyncIterator[Minute]:
    """A vela do minuto a formar-se, a cada negócio (até a ligação cair: quem
    chama volta a ligar). Uma vela com um `time` novo quer dizer que a anterior fechou."""
    if instrument.source == "coinbase":
        async for minute in _coinbase_stream(instrument.symbol):
            yield minute
        return
    url = BINANCE_STREAMS[instrument.market].format(symbol=instrument.symbol.lower())
    async with websockets.connect(url, ping_interval=20, max_queue=1024) as socket:
        async for message in _messages(socket):
            data = json.loads(message)
            kline = data.get("k")
            if not kline:
                continue
            yield Minute(
                int(kline["t"]), float(kline["o"]), float(kline["h"]), float(kline["l"]), float(kline["c"]), float(kline["v"])
            )


async def _messages(socket) -> AsyncIterator[str]:
    """As mensagens da ligação; calada durante `SILENCE_SECONDS`, dá erro (quem chama volta a ligar)."""
    while True:
        try:
            message = await asyncio.wait_for(socket.recv(), SILENCE_SECONDS)
        except TimeoutError:
            raise TimeoutError(f"sem mensagens da corretora há {SILENCE_SECONDS} s") from None
        except websockets.ConnectionClosedOK:
            return
        yield message


async def _coinbase_stream(symbol: str) -> AsyncIterator[Minute]:
    async with websockets.connect(COINBASE_STREAM, ping_interval=20, max_queue=1024) as socket:
        await socket.send(json.dumps({"type": "subscribe", "product_ids": [symbol], "channels": ["matches", "heartbeat"]}))
        current: Minute | None = None
        async for message in _messages(socket):
            data = json.loads(message)
            if data.get("type") not in ("match", "last_match"):
                continue
            price = float(data["price"])
            size = float(data["size"])
            moment = datetime.fromisoformat(data["time"].replace("Z", "+00:00"))
            start = int(moment.timestamp() * 1000) // MINUTE_MS * MINUTE_MS
            # O último negócio de antes de ligar (last_match) não conta para o volume do minuto
            volume = 0.0 if data["type"] == "last_match" else size
            if current is None or start > current.time:
                current = Minute(start, price, price, price, price, volume)
            elif start == current.time:
                current.high = max(current.high, price)
                current.low = min(current.low, price)
                current.close = price
                current.volume += volume
            else:
                continue
            yield Minute(current.time, current.open, current.high, current.low, current.close, current.volume)

"""Velas de 1 minuto da API pública da Coinbase Exchange (sem chave).

A Coinbase dá até 300 velas por pedido, das mais recentes para as mais
antigas, e não tem vela nos minutos sem negócio. O limite público ronda os 10
pedidos por segundo (do IP): vai-se a pouco menos disso, com o intervalo
partilhado pelas threads (`RateLimiter`), e num 429 espera-se e tenta-se outra vez. Antes de descarregar procura-se o primeiro dia com velas (as
diárias, 300 dias por pedido), para não perguntar pelos meses em que o mercado
ainda não existia.
"""

import logging
import threading
import uuid
from datetime import datetime, timezone

import requests

from . import control

log = logging.getLogger(__name__)

BASE_URL = "https://api.exchange.coinbase.com/products"
PAGE = 300
MINUTE_S = 60
DAY_S = 86_400

# Intervalo mínimo entre pedidos (~8 por segundo) e as tentativas num 429, 5xx ou ligação cortada
MIN_INTERVAL_S = 0.125
RETRIES = 6

# A Coinbase Exchange abriu em janeiro de 2015
EARLIEST = datetime(2015, 1, 1, tzinfo=timezone.utc)

# O intervalo entre pedidos, o mesmo para todas as threads
LIMITER = control.RateLimiter(MIN_INTERVAL_S)

# Uma sessão por thread (o requests não garante que se possa partilhar uma)
_local = threading.local()


def _session() -> requests.Session:
    session = getattr(_local, "session", None)
    if session is None:
        session = _local.session = requests.Session()
        session.headers["User-Agent"] = "IntriStock"
    return session


def _iso(seconds: int) -> str:
    return datetime.fromtimestamp(seconds, tz=timezone.utc).isoformat().replace("+00:00", "Z")


def _get(symbol: str, granularity: int, start_s: int, end_s: int) -> list:
    """Uma página de velas com início em [start_s, end_s] (o `end` é inclusivo)."""
    for attempt in range(RETRIES):
        LIMITER.acquire()
        try:
            response = _session().get(
                f"{BASE_URL}/{symbol}/candles",
                params={"granularity": granularity, "start": _iso(start_s), "end": _iso(end_s)},
                timeout=30,
            )
        except (requests.ConnectionError, requests.Timeout) as error:
            # A Coinbase às vezes corta a ligação: espera e tenta outra vez
            delay = 1 + attempt * 2
            log.warning("Coinbase sem resposta em %s (%s), à espera %ss", symbol, error, delay)
            control.sleep(delay)
            continue
        if response.status_code == 429 or response.status_code >= 500:
            delay = 1 + attempt * 2
            log.warning("Coinbase respondeu HTTP %s em %s, à espera %ss", response.status_code, symbol, delay)
            if response.status_code == 429:
                LIMITER.pause(delay)
            control.sleep(delay)
            continue
        response.raise_for_status()
        return response.json()
    raise RuntimeError(f"A Coinbase não respondeu a {symbol} depois de {RETRIES} tentativas")


def first_candle_ms(symbol: str, until_ms: int) -> int | None:
    """O início do primeiro dia com velas (ms UTC), procurando aos blocos de
    300 dias a partir de 2015; nulo se não houver nenhuma até `until_ms`."""
    cursor = int(EARLIEST.timestamp())
    until_s = until_ms // 1000
    while cursor < until_s:
        end = min(cursor + PAGE * DAY_S, until_s)
        page = _get(symbol, DAY_S, cursor, end - DAY_S)
        if page:
            return min(int(row[0]) for row in page) * 1000
        cursor = end
    return None


def fetch_candles(instrument_id: str, symbol: str, start_ms: int, end_ms: int) -> list[list]:
    """Velas com abertura em [start_ms, end_ms[, já nas colunas do ClickHouse
    (sem o volume na cotada nem o nº de negócios, que a Coinbase não dá)."""
    instrument_uuid = uuid.UUID(instrument_id)
    rows: dict[int, list] = {}
    cursor = start_ms // 1000
    end_s = end_ms // 1000

    while cursor < end_s:
        control.check()
        window_end = min(cursor + PAGE * MINUTE_S, end_s)
        page = _get(symbol, MINUTE_S, cursor, window_end - MINUTE_S)
        # [início s, mínima, máxima, abertura, fecho, volume]
        for start, low, high, open_, close, volume in page:
            start = int(start)
            if start < cursor or start >= window_end:
                continue
            rows[start] = [
                instrument_uuid,
                datetime.fromtimestamp(start, tz=timezone.utc),
                float(open_),
                float(high),
                float(low),
                float(close),
                float(volume),
                None,
                None,
            ]
        cursor = window_end

    return [rows[key] for key in sorted(rows)]

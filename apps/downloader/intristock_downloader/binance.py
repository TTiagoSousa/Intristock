"""Velas de 1 minuto da API pública da Binance (sem chave).

Respeita o limite de peso por minuto: a Binance diz em cada resposta quanto já
se gastou, e perto do teto espera pelo minuto seguinte em vez de levar um 429
(e, se insistir, um bloqueio do IP). O peso é do IP: as threads que vão ao
mesmo endereço (o spot ou os futuros) esperam todas juntas (`RateLimiter`).
Uma ligação cortada, um timeout ou um 5xx repetem-se (`RETRIES` vezes, cada vez
a esperar mais), como na Coinbase.
"""

import logging
import threading
import time
import uuid
from datetime import datetime, timezone

import requests

from . import control

log = logging.getLogger(__name__)

MINUTE_MS = 60_000

# spot: 1000 velas pesam 2; futuros: 1000 pesam 5 (1500 já pesariam 10)
ENDPOINTS = {
    "spot": ("https://api.binance.com/api/v3/klines", 6000),
    "futures": ("https://fapi.binance.com/fapi/v1/klines", 2400),
}
PAGE = 1000

# Abranda ao chegar a 80% do limite do minuto
SAFETY = 0.8

# Funding dos perpétuos: 1000 por página (perto de um ano, de 8 em 8 horas)
FUNDING_URL = "https://fapi.binance.com/fapi/v1/fundingRate"

# As tentativas numa ligação cortada, num timeout ou num 5xx
RETRIES = 6

# Um limite por endereço (o peso do spot e o dos futuros contam à parte)
LIMITERS = {"spot": control.RateLimiter(), "futures": control.RateLimiter()}

# Uma sessão por thread (o requests não garante que se possa partilhar uma)
_local = threading.local()


def _session() -> requests.Session:
    session = getattr(_local, "session", None)
    if session is None:
        session = _local.session = requests.Session()
    return session


def _endpoint(instrument_type: str) -> tuple[str, int]:
    return ENDPOINTS["spot" if instrument_type == "spot" else "futures"]


def _limiter(url: str) -> control.RateLimiter:
    return LIMITERS["futures" if "://fapi." in url else "spot"]


def _until_next_minute() -> float:
    return 60 - time.time() % 60 + 1


def _retry_delay(failures: int) -> float:
    return 1 + failures * 2


def _get(url: str, limit: int, params: dict) -> list:
    limiter = _limiter(url)
    failures = 0
    while True:
        limiter.acquire()
        try:
            response = _session().get(url, params=params, timeout=30)
        except (requests.ConnectionError, requests.Timeout) as error:
            # A rede falhou (ou a Binance não respondeu a tempo): espera e tenta outra vez
            failures += 1
            if failures >= RETRIES:
                raise RuntimeError(f"A Binance não respondeu depois de {RETRIES} tentativas: {error}") from error
            log.warning("Binance sem resposta (%s), à espera %ss", error, _retry_delay(failures))
            control.sleep(_retry_delay(failures))
            continue

        # 429: demasiados pedidos; 418: IP bloqueado por ter ignorado os 429. A
        # espera vale para todas as threads que vão a este endereço
        if response.status_code in (418, 429):
            wait = int(response.headers.get("Retry-After", "60"))
            log.warning("Binance pediu para esperar %ss (HTTP %s)", wait, response.status_code)
            limiter.pause(wait)
            continue

        # Um erro do lado deles: espera e tenta outra vez
        if response.status_code >= 500:
            failures += 1
            if failures >= RETRIES:
                response.raise_for_status()
            log.warning("Binance respondeu HTTP %s, à espera %ss", response.status_code, _retry_delay(failures))
            control.sleep(_retry_delay(failures))
            continue

        response.raise_for_status()

        used = int(response.headers.get("X-MBX-USED-WEIGHT-1M", "0"))
        if used > limit * SAFETY:
            log.info("Peso da Binance em %s/%s, à espera do minuto seguinte", used, limit)
            limiter.pause(_until_next_minute())

        return response.json()


def fetch_candles(
    instrument_id: str, instrument_type: str, symbol: str, start_ms: int, end_ms: int
) -> list[list]:
    """Velas com abertura em [start_ms, end_ms[, já nas colunas do ClickHouse."""
    url, limit = _endpoint(instrument_type)
    instrument_uuid = uuid.UUID(instrument_id)
    rows: list[list] = []
    cursor = start_ms

    while cursor < end_ms:
        control.check()
        page = _get(
            url,
            limit,
            {
                "symbol": symbol,
                "interval": "1m",
                "startTime": cursor,
                "endTime": end_ms - 1,
                "limit": PAGE,
            },
        )
        if not page:
            break

        for kline in page:
            open_ms = int(kline[0])
            if open_ms >= end_ms:
                break
            rows.append(
                [
                    instrument_uuid,
                    datetime.fromtimestamp(open_ms / 1000, tz=timezone.utc),
                    float(kline[1]),
                    float(kline[2]),
                    float(kline[3]),
                    float(kline[4]),
                    float(kline[5]),
                    float(kline[7]),
                    int(kline[8]),
                ]
            )

        cursor = int(page[-1][0]) + MINUTE_MS
        if len(page) < PAGE:
            break

    return rows


def fetch_funding(instrument_id: str, symbol: str, start_ms: int, end_ms: int) -> list[list]:
    """Taxas de funding com hora em [start_ms, end_ms[, nas colunas do ClickHouse."""
    instrument_uuid = uuid.UUID(instrument_id)
    rows: list[list] = []
    cursor = start_ms

    while cursor < end_ms:
        control.check()
        page = _get(
            FUNDING_URL,
            ENDPOINTS["futures"][1],
            {"symbol": symbol, "startTime": cursor, "endTime": end_ms - 1, "limit": PAGE},
        )
        if not page:
            break
        for item in page:
            time_ms = int(item["fundingTime"])
            if time_ms >= end_ms:
                break
            rows.append(
                [instrument_uuid, datetime.fromtimestamp(time_ms / 1000, tz=timezone.utc), float(item["fundingRate"])]
            )
        cursor = int(page[-1]["fundingTime"]) + 1
        if len(page) < PAGE:
            break

    return rows

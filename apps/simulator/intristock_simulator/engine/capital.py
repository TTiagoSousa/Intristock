"""Depósitos e funding."""

from datetime import datetime, timezone

import numpy as np

from .constants import DEPOSIT_MONTHS, FUNDING_EVERY_MS


def _deposits(strategy: dict, start_ms: int, end_ms: int) -> tuple[np.ndarray, np.ndarray]:
    """Quando entram os depósitos e quanto: no primeiro dia de cada mês,
    trimestre ou ano (UTC) depois do início, até ao fim. Com `depositIncrease`
    o valor sobe X a cada trimestre ou ano desde o primeiro."""
    times = _deposit_times(strategy, start_ms, end_ms)
    base = float(strategy.get("depositAmount") or 0)
    increase = strategy.get("depositIncrease") or {}
    step = DEPOSIT_MONTHS.get(increase.get("every") or "")
    if not len(times) or not step or not increase.get("amount"):
        return times, np.full(len(times), base)
    months = np.array(
        [(moment.year * 12 + moment.month - 1) for moment in (datetime.fromtimestamp(t / 1000, timezone.utc) for t in times)]
    )
    return times, base + float(increase["amount"]) * ((months - months[0]) // step)


def _deposit_times(strategy: dict, start_ms: int, end_ms: int) -> np.ndarray:
    """Quando entram os depósitos: no primeiro dia de cada mês, trimestre ou
    ano (UTC) depois do início, até ao fim."""
    every = DEPOSIT_MONTHS.get(strategy.get("depositEvery") or "")
    if not every or not strategy.get("depositAmount"):
        return np.empty(0, np.int64)

    start = datetime.fromtimestamp(start_ms / 1000, timezone.utc)
    # O primeiro mês do período (janeiro, abril… num trimestre) depois do início
    month = (start.year * 12 + start.month - 1) // every * every + every
    times = []
    while True:
        moment = datetime(month // 12, month % 12 + 1, 1, tzinfo=timezone.utc)
        time = int(moment.timestamp() * 1000)
        if time > end_ms:
            break
        times.append(time)
        month += every
    return np.array(times, np.int64)


def _funding_schedule(strategy: dict, funding, start_ms: int, end_ms: int):
    """As horas de funding e a taxa de cada uma (em fração): as da Binance
    (`funding`, lidas do ClickHouse) ou uma taxa fixa de 8 em 8 horas."""
    config = strategy.get("funding") or {}
    mode = config.get("mode")
    if mode == "historical" and funding is not None:
        times, rates = funding
        keep = (times > start_ms) & (times <= end_ms)
        return times[keep], rates[keep]
    if mode == "fixed" and config.get("ratePct"):
        first = (start_ms // FUNDING_EVERY_MS + 1) * FUNDING_EVERY_MS
        times = np.arange(first, end_ms + 1, FUNDING_EVERY_MS, dtype=np.int64)
        return times, np.full(len(times), float(config["ratePct"]) / 100)
    return np.empty(0, np.int64), np.empty(0, np.float64)

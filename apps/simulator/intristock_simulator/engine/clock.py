"""A hora local, os horários (bloqueados, por entrada) e os períodos excluídos."""

import logging
from datetime import datetime, timedelta, timezone
from zoneinfo import ZoneInfo, ZoneInfoNotFoundError

import numpy as np

from ..market.candles import Bars
from .constants import DAY_MS, DURATION_MS, HOUR_MS, MINUTE_MS


log = logging.getLogger(__name__)


class Clock:
    """A hora local (no fuso da estratégia) de cada instante, para os horários
    bloqueados, os períodos excluídos e os limites do dia."""

    def __init__(self, name: str | None, start_ms: int, end_ms: int):
        try:
            self.zone = ZoneInfo(name) if name and name != "UTC" else timezone.utc
        except (ZoneInfoNotFoundError, ValueError):
            log.warning("Fuso horário desconhecido (%s): usa-se UTC", name)
            self.zone = timezone.utc
        self.first_hour = start_ms // HOUR_MS
        if self.zone is timezone.utc:
            self.offsets = np.zeros(1, np.int64)
            self.offset_list = [0]
            return
        # A diferença para UTC em cada hora (muda com a hora de verão)
        hours = range(self.first_hour, end_ms // HOUR_MS + 2)
        self.offsets = np.array(
            [int(datetime.fromtimestamp(hour * 3600, self.zone).utcoffset().total_seconds() * 1000) for hour in hours],
            np.int64,
        )
        # Em lista, para um instante de cada vez (o numpy num número só é lento)
        self.offset_list = self.offsets.tolist()

    def local(self, ms):
        index = np.clip(np.asarray(ms) // HOUR_MS - self.first_hour, 0, len(self.offsets) - 1)
        return np.asarray(ms) + self.offsets[index]

    def day(self, ms: int) -> int:
        index = min(max(ms // HOUR_MS - self.first_hour, 0), len(self.offset_list) - 1)
        return (ms + self.offset_list[index]) // DAY_MS

    def midnight(self, date: str) -> int:
        """Meia-noite de um dia ('YYYY-MM-DD') na hora local, em ms UTC."""
        year, month, day = (int(part) for part in date[:10].split("-"))
        return int(datetime(year, month, day, tzinfo=self.zone).timestamp() * 1000)


def _clock_minutes(text: str | None) -> int | None:
    if not text:
        return None
    hours, minutes = text.split(":")[:2]
    return int(hours) * 60 + int(minutes)


def _blocked_bars(bars: Bars, clock: Clock, rules: list[dict]) -> np.ndarray:
    """As velas que abrem num dia e hora bloqueados."""
    if not rules:
        return np.zeros(len(bars), bool)
    return _matches(clock.local(bars.time), rules)


def _allowed(local: np.ndarray, schedule: dict | None) -> np.ndarray | None:
    """Onde um horário deixa (None = sempre): `only` só nos dias e horas das
    regras, `except` fora deles."""
    rules = (schedule or {}).get("rules") or []
    if not rules:
        return None
    hit = _matches(local, rules)
    return hit if schedule.get("mode") == "only" else ~hit


# Uma semana de minutos locais, a começar numa segunda (5/1/1970), para ver onde um horário deixa
_WEEK_MINUTES = 4 * DAY_MS + np.arange(7 * 24 * 60, dtype=np.int64) * MINUTE_MS


def _hour_band(schedule: dict | None) -> list[int] | None:
    """As horas locais em que um horário deixa entrar nalgum dia (nulo = sem horário)."""
    allowed = _allowed(_WEEK_MINUTES, schedule)
    if allowed is None:
        return None
    hours = (_WEEK_MINUTES % DAY_MS) // HOUR_MS
    return sorted({int(h) for h in hours[allowed]})


def _matches(local: np.ndarray, rules: list[dict]) -> np.ndarray:
    """Os instantes (em hora local) que caem numa das regras. Cada regra tem
    dias (0 = segunda; nenhum = todos) e um intervalo de horas (nenhum = o dia
    todo; se o fim for antes do início, passa a meia-noite)."""
    blocked = np.zeros(len(local), bool)
    days = local // DAY_MS
    weekday = (days + 3) % 7  # 1970-01-01 foi uma quinta
    minute = (local % DAY_MS) // MINUTE_MS
    for rule in rules:
        chosen = rule.get("days") or []
        in_day = np.isin(weekday, chosen) if chosen else np.ones(len(local), bool)
        start, end = _clock_minutes(rule.get("from")), _clock_minutes(rule.get("to"))
        if start is None or end is None or start == end:
            in_time = np.ones(len(local), bool)
        elif start < end:
            in_time = (minute >= start) & (minute < end)
        else:
            in_time = (minute >= start) | (minute < end)
        blocked |= in_day & in_time
    return blocked


def _excluded_periods(clock: Clock, periods: list[dict]) -> list[tuple[int, int]]:
    """Os períodos excluídos em ms UTC [início, fim[, com o dia do fim inteiro."""
    result = []
    for period in periods or []:
        start = clock.midnight(period["from"])
        end_day = datetime.strptime(period["to"][:10], "%Y-%m-%d") + timedelta(days=1)
        end = clock.midnight(end_day.strftime("%Y-%m-%d"))
        if end > start:
            result.append((start, end))
    return sorted(result)


def _period_index(periods: list[tuple[int, int]]) -> tuple[np.ndarray, np.ndarray]:
    """Os inícios dos períodos (por ordem) e, em cada um, o fim mais longe até
    ali, para ver numa busca se um instante cai num deles (mesmo sobrepostos)."""
    starts = np.array([start for start, _ in periods], np.int64)
    ends = np.array([end for _, end in periods], np.int64)
    return starts, np.maximum.accumulate(ends) if len(ends) else ends


def _in_periods(time_ms, index: tuple[np.ndarray, np.ndarray]):
    """Se um instante (ou cada um de uma lista) cai num período [início, fim[."""
    starts, reach = index
    if not len(starts):
        return np.zeros(np.shape(time_ms), bool)
    at = np.searchsorted(starts, time_ms, side="right") - 1
    return (at >= 0) & (np.asarray(time_ms) < reach[np.maximum(at, 0)])


def _duration(value: dict | None) -> int:
    """Uma duração ({count, unit: hours|days|weeks}) em ms; 0 sem ela."""
    if not value or not value.get("count"):
        return 0
    return int(float(value["count"]) * DURATION_MS.get(value.get("unit") or "days", DAY_MS))

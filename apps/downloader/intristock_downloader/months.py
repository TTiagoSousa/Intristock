"""Contas com meses de calendário em UTC: é ao mês que se descarrega."""

from datetime import datetime, timezone


def month_start(moment: datetime) -> datetime:
    return datetime(moment.year, moment.month, 1, tzinfo=timezone.utc)


def next_month(month: datetime) -> datetime:
    if month.month == 12:
        return datetime(month.year + 1, 1, 1, tzinfo=timezone.utc)
    return datetime(month.year, month.month + 1, 1, tzinfo=timezone.utc)


def months_between(start: datetime, end: datetime) -> list[datetime]:
    """Os meses que o intervalo [start, end[ toca."""
    months = []
    month = month_start(start)
    while month < end:
        months.append(month)
        month = next_month(month)
    return months


def to_ms(moment: datetime) -> int:
    return int(moment.timestamp() * 1000)

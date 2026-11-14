"""Ligação ao ClickHouse e as migrations dele.

O Prisma não gere o ClickHouse: as tabelas vivem em clickhouse/migrations/*.sql
e aplicam-se no arranque, por ordem, registadas em schema_migrations com o
nome da app à frente (o simulador tem as suas na mesma tabela).
"""

import logging
from pathlib import Path

import clickhouse_connect
from clickhouse_connect.driver.client import Client

from .config import Config

log = logging.getLogger(__name__)

MIGRATIONS_DIR = Path(__file__).resolve().parents[1] / "clickhouse" / "migrations"
APP = "downloader"

CANDLE_COLUMNS = [
    "instrument_id",
    "open_time",
    "open",
    "high",
    "low",
    "close",
    "volume",
    "quote_volume",
    "trades",
]


def connect(config: Config) -> Client:
    return clickhouse_connect.get_client(
        host=config.clickhouse_host,
        port=config.clickhouse_port,
        secure=config.clickhouse_secure,
        username=config.clickhouse_user,
        password=config.clickhouse_password,
        database=config.clickhouse_database,
    )


def migrate(client: Client) -> None:
    client.command(
        """
        CREATE TABLE IF NOT EXISTS schema_migrations
        (
            version    String,
            applied_at DateTime DEFAULT now()
        )
        ENGINE = MergeTree
        ORDER BY version
        """
    )
    applied = {row[0] for row in client.query("SELECT version FROM schema_migrations").result_rows}

    for path in sorted(MIGRATIONS_DIR.glob("*.sql")):
        version = f"{APP}/{path.stem}"
        if version in applied:
            continue
        client.command(path.read_text(encoding="utf-8"))
        client.insert("schema_migrations", [[version]], column_names=["version"])
        log.info("Migration do ClickHouse aplicada: %s", version)


def insert_candles(client: Client, rows: list[list]) -> None:
    if rows:
        client.insert("market_candles", rows, column_names=CANDLE_COLUMNS)


def insert_funding(client: Client, rows: list[list]) -> None:
    if rows:
        client.insert("market_funding", rows, column_names=["instrument_id", "funding_time", "rate"])

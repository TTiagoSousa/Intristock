"""Ligação ao ClickHouse e as migrations do simulador.

As tabelas dos resultados vivem em clickhouse/migrations/*.sql e aplicam-se no
arranque, registadas em schema_migrations com o nome da app à frente (a mesma
tabela do downloader). As velas (market_candles) são do downloader: aqui só se
leem.
"""

import logging
from pathlib import Path

import clickhouse_connect
from clickhouse_connect.driver.client import Client

from .config import Config

log = logging.getLogger(__name__)

MIGRATIONS_DIR = Path(__file__).resolve().parents[2] / "clickhouse" / "migrations"
APP = "simulator"


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

"""Ligação ao Postgres (a mesma base do backend)."""

import psycopg
from psycopg.rows import dict_row


def open_connection(postgres_conninfo: str, autocommit: bool = False) -> psycopg.Connection:
    return psycopg.connect(postgres_conninfo, autocommit=autocommit, row_factory=dict_row)

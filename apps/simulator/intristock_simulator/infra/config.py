"""Configuração, lida do mesmo ficheiro que o backend usa.

Em desenvolvimento é o apps/backend/.env; na VM o systemd passa as variáveis do
/etc/intristock/backend.env. Um só sítio para as credenciais das duas bases.

O downloader e o simulador têm cada um uma cópia deste ficheiro, de propósito:
são apps independentes, com o seu venv.
"""

import os
from dataclasses import dataclass
from pathlib import Path
from urllib.parse import unquote, urlsplit

from dotenv import load_dotenv
from psycopg.conninfo import make_conninfo

DEFAULT_ENV_FILE = Path(__file__).resolve().parents[3] / "backend" / ".env"


@dataclass(frozen=True)
class Config:
    postgres_conninfo: str
    clickhouse_host: str
    clickhouse_port: int
    clickhouse_secure: bool
    clickhouse_database: str
    clickhouse_user: str
    clickhouse_password: str


def _postgres_conninfo(url: str) -> str:
    # O Node aceita uma password com "@" sem codificar e o libpq não; e o Prisma
    # aceita parâmetros (?schema=public) que o libpq não conhece. Partido em
    # campos, passa nos dois casos
    parts = urlsplit(url)
    return make_conninfo(
        host=parts.hostname,
        port=parts.port or 5432,
        dbname=unquote(parts.path.lstrip("/")),
        user=unquote(parts.username or ""),
        password=unquote(parts.password or ""),
    )


def load_config() -> Config:
    # Variáveis já definidas (as do systemd) ganham ao ficheiro
    load_dotenv(os.environ.get("ENV_FILE", DEFAULT_ENV_FILE), override=False)

    clickhouse = urlsplit(os.environ.get("CLICKHOUSE_URL", "http://localhost:8123"))
    secure = clickhouse.scheme == "https"

    return Config(
        postgres_conninfo=_postgres_conninfo(os.environ["DATABASE_URL"]),
        clickhouse_host=clickhouse.hostname or "localhost",
        clickhouse_port=clickhouse.port or (8443 if secure else 8123),
        clickhouse_secure=secure,
        clickhouse_database=os.environ.get("CLICKHOUSE_DATABASE", "intristock"),
        clickhouse_user=os.environ.get("CLICKHOUSE_USER", "default"),
        clickhouse_password=os.environ.get("CLICKHOUSE_PASSWORD", ""),
    )

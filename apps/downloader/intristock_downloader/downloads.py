"""Pedidos de velas (MarketDataDownload): a fila que o backend enche.

Para cada mês do intervalo pedido, vê no MarketDataMonth se já está no
ClickHouse. Os que faltam descarrega-os da corretora do mercado (Binance ou
Coinbase); os que outro trabalhador está
a descarregar espera por eles. O mês corrente volta sempre a ser pedido, porque
entretanto há velas novas.

Vários pedidos correm ao mesmo tempo (um por thread, ver `__main__`); a fila
dá primeiro os que têm menos meses por descarregar, para um pedido de anos não
fazer esperar os pequenos. Ao parar (`control.Stopped`), o pedido a meio volta
à fila e o mês a meio fica por descarregar.
"""

import logging
from datetime import datetime, timedelta, timezone

import psycopg
from clickhouse_connect.driver.client import Client
from psycopg.rows import dict_row

from . import binance, coinbase, control
from .clickhouse import insert_candles, insert_funding
from .months import months_between, next_month, to_ms

log = logging.getLogger(__name__)

# Um mês "a carregar" há mais do que isto é de um processo que morreu
STALE_LOADING = timedelta(minutes=15)
# O que fica no mês que estava a meio quando o downloader parou
INTERRUPTED = "Interrompido (o downloader parou); volta a ser descarregado"


def reset_interrupted(conn: psycopg.Connection) -> None:
    """Pedidos que ficaram a meio (o downloader foi reiniciado) voltam à fila, e
    os meses que estavam a carregar ficam por descarregar (sem esperar que passem
    os `STALE_LOADING`). Só no arranque: há um downloader só."""
    with conn.transaction():
        result = conn.execute(
            """UPDATE "MarketDataDownload" SET status = 'queued', "startedAt" = NULL, "currentMonth" = NULL
               WHERE status = 'running'"""
        )
        conn.execute(
            """UPDATE "MarketDataMonth" SET status = 'failed', error = %s, "updatedAt" = now()
               WHERE status = 'loading'""",
            (INTERRUPTED,),
        )
    if result.rowcount:
        log.info("%s pedido(s) interrompido(s) voltaram à fila", result.rowcount)


def requeue(conn: psycopg.Connection, download_id: str, instrument_id: str | None, month: datetime | None) -> None:
    """Um pedido a meio volta à fila (o downloader está a parar ou a ligação ao
    Postgres caiu) e o mês que estava a carregar fica por descarregar."""
    with conn.transaction():
        conn.execute(
            """UPDATE "MarketDataDownload" SET status = 'queued', "startedAt" = NULL, "currentMonth" = NULL
               WHERE id = %s AND status = 'running'""",
            (download_id,),
        )
        if instrument_id and month:
            conn.execute(
                """UPDATE "MarketDataMonth" SET status = 'failed', error = %s, "updatedAt" = now()
                   WHERE "instrumentId" = %s AND month = %s AND status = 'loading'""",
                (INTERRUPTED, instrument_id, month.replace(tzinfo=None)),
            )


def claim_next(conn: psycopg.Connection) -> dict | None:
    """O próximo pedido: o com menos meses por descarregar (os que ainda não
    estão `loaded`) e, entre esses, o mais antigo. SKIP LOCKED: com vários
    trabalhadores, cada um apanha um pedido diferente."""
    with conn.transaction():
        return conn.execute(
            """
            UPDATE "MarketDataDownload" d
               SET status = 'running', "startedAt" = now()
              FROM "Instrument" i
             WHERE i.id = d."instrumentId"
               AND d.id = (
                   SELECT q.id FROM "MarketDataDownload" q
                    WHERE q.status = 'queued'
                    ORDER BY (
                          SELECT count(*)
                            FROM generate_series(
                                     date_trunc('month', q."fromDate"),
                                     q."toDate" - interval '1 millisecond',
                                     interval '1 month'
                                 ) AS m(month)
                           WHERE NOT EXISTS (
                                 SELECT 1 FROM "MarketDataMonth" mm
                                  WHERE mm."instrumentId" = q."instrumentId"
                                    AND mm.month = m.month
                                    AND mm.status = 'loaded'
                           )
                          ),
                          q."createdAt"
                    FOR UPDATE OF q SKIP LOCKED
                    LIMIT 1
               )
            RETURNING d.id, d."instrumentId", d."fromDate", d."toDate",
                      i.source, i.type, i.symbol, i.metadata
            """
        ).fetchone()


def _utc(value: datetime) -> datetime:
    # As colunas do Prisma são timestamp sem fuso, sempre em UTC
    return value.replace(tzinfo=timezone.utc) if value.tzinfo is None else value


def _listed_at(metadata: dict | None) -> datetime | None:
    listed = (metadata or {}).get("listedAt")
    return datetime.fromisoformat(listed.replace("Z", "+00:00")) if listed else None


def _claim_month(conn: psycopg.Connection, instrument_id: str, month: datetime, current: bool):
    """Decide o que fazer com um mês: 'skip' (já está), 'wait' (outro está a
    descarregar) ou 'load' (fica marcado como nosso)."""
    with conn.transaction():
        row = conn.execute(
            """SELECT status, candles, "updatedAt" FROM "MarketDataMonth"
                WHERE "instrumentId" = %s AND month = %s FOR UPDATE""",
            (instrument_id, month.replace(tzinfo=None)),
        ).fetchone()

        if row and row["status"] == "loaded" and not current:
            return "skip", row["candles"] or 0

        fresh = row and datetime.now(timezone.utc) - _utc(row["updatedAt"]) < STALE_LOADING
        if row and row["status"] == "loading" and fresh:
            return "wait", 0

        conn.execute(
            """INSERT INTO "MarketDataMonth" ("instrumentId", month, status, error, "updatedAt")
               VALUES (%s, %s, 'loading', NULL, now())
               ON CONFLICT ("instrumentId", month)
               DO UPDATE SET status = 'loading', error = NULL, "updatedAt" = now()""",
            (instrument_id, month.replace(tzinfo=None)),
        )
        return "load", 0


def _finish_month(conn, instrument_id: str, month: datetime, status: str, candles=None, error=None):
    with conn.transaction():
        conn.execute(
            """UPDATE "MarketDataMonth"
                  SET status = %s, candles = %s, error = %s, "updatedAt" = now()
                WHERE "instrumentId" = %s AND month = %s""",
            (status, candles, error, instrument_id, month.replace(tzinfo=None)),
        )


def _progress(conn, download_id: str, months_done: int, candles: int, current_month):
    with conn.transaction():
        conn.execute(
            """UPDATE "MarketDataDownload"
                  SET "monthsDone" = %s, candles = %s, "currentMonth" = %s
                WHERE id = %s""",
            (
                months_done,
                candles,
                current_month.replace(tzinfo=None) if current_month else None,
                download_id,
            ),
        )


def _finish(conn, download_id: str, status: str, error: str | None = None):
    with conn.transaction():
        conn.execute(
            """UPDATE "MarketDataDownload"
                  SET status = %s, error = %s, "currentMonth" = NULL, "finishedAt" = now()
                WHERE id = %s""",
            (status, error, download_id),
        )
        # Avisa quem estiver à espera destas velas (o simulador). Só sai no commit
        conn.execute("SELECT pg_notify('market_data_download_done', %s)", (download_id,))


def _fetch_candles(source: str, job: dict, instrument_id: str, start_ms: int, end_ms: int) -> list[list]:
    """As velas de um mês, da corretora do mercado."""
    if source == "coinbase":
        return coinbase.fetch_candles(instrument_id, job["symbol"], start_ms, end_ms)
    if source == "binance":
        return binance.fetch_candles(instrument_id, job["type"], job["symbol"], start_ms, end_ms)
    raise ValueError(f"Corretora sem velas para descarregar: {source}")


def process(conn: psycopg.Connection, clickhouse: Client, job: dict, current: dict | None = None) -> None:
    """Descarrega um pedido. `current` (se vier) fica com o mês que está a
    carregar, para quem chama o devolver à fila se a ligação ao Postgres cair.
    Ao parar (`control.Stopped`) o pedido volta à fila e o erro sobe."""
    current = current if current is not None else {}
    try:
        _process(conn, clickhouse, job, current)
    except control.Stopped:
        log.info("Pedido %s interrompido: volta à fila", job["id"])
        requeue(conn, job["id"], job["instrumentId"], current.get("month"))
        raise


def _process(conn: psycopg.Connection, clickhouse: Client, job: dict, current: dict) -> None:
    download_id = job["id"]
    instrument_id = job["instrumentId"]
    start, end = _utc(job["fromDate"]), _utc(job["toDate"])
    source = job["source"]
    listed_at = _listed_at(job["metadata"])
    months = months_between(start, end)

    log.info("Pedido %s: %s %s %s, %s meses", download_id, source, job["symbol"], job["type"], len(months))

    # A Coinbase não diz quando listou o mercado: procura-se o primeiro dia com velas
    if source == "coinbase" and listed_at is None:
        try:
            first = coinbase.first_candle_ms(job["symbol"], to_ms(min(end, datetime.now(timezone.utc))))
        except control.Stopped:
            raise
        except Exception as error:  # noqa: BLE001
            message = str(error)[:500]
            log.exception("Falhou a procura do início de %s", job["symbol"])
            _finish(conn, download_id, "failed", message)
            return
        listed_at = datetime.fromtimestamp(first / 1000, tz=timezone.utc) if first else end

    total_candles = 0
    for index, month in enumerate(months):
        _progress(conn, download_id, index, total_candles, month)
        month_end = next_month(month)
        now = datetime.now(timezone.utc)
        current_month = month_end > now

        while True:
            action, candles = _claim_month(conn, instrument_id, month, current_month)
            if action != "wait":
                break
            control.sleep(2)

        if action == "skip":
            total_candles += candles
            continue
        current["month"] = month

        try:
            # Antes da listagem não há velas: nem vale a pena perguntar
            if listed_at and month_end <= listed_at:
                rows = []
            else:
                rows = _fetch_candles(source, job, instrument_id, to_ms(month), to_ms(min(month_end, now)))
            insert_candles(clickhouse, rows)
        except control.Stopped:
            raise
        except Exception as error:  # noqa: BLE001 — qualquer falha marca o mês e o pedido
            message = str(error)[:500]
            log.exception("Falhou %s de %s", month.strftime("%Y-%m"), job["symbol"])
            _finish_month(conn, instrument_id, month, "failed", error=message)
            _finish(conn, download_id, "failed", message)
            return

        _finish_month(conn, instrument_id, month, "loaded", candles=len(rows))
        current["month"] = None
        total_candles += len(rows)
        log.info("%s %s: %s velas", job["symbol"], month.strftime("%Y-%m"), len(rows))

    # Nos perpétuos vem também o funding do período (poucos pedidos: uma
    # página dá quase um ano). Volta sempre a ser pedido; repetido fica um só
    if job["type"] == "perpetual" and source == "binance":
        try:
            funding = binance.fetch_funding(instrument_id, job["symbol"], to_ms(start), to_ms(min(end, datetime.now(timezone.utc))))
            insert_funding(clickhouse, funding)
            log.info("%s: %s taxas de funding", job["symbol"], len(funding))
        except control.Stopped:
            raise
        except Exception as error:  # noqa: BLE001
            message = str(error)[:500]
            log.exception("Falhou o funding de %s", job["symbol"])
            _finish(conn, download_id, "failed", message)
            return

    _progress(conn, download_id, len(months), total_candles, None)
    _finish(conn, download_id, "done")
    log.info("Pedido %s concluído: %s velas", download_id, total_candles)


def open_connection(postgres_conninfo: str, autocommit: bool = False) -> psycopg.Connection:
    return psycopg.connect(postgres_conninfo, autocommit=autocommit, row_factory=dict_row)

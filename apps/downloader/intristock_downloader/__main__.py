"""Arranque do downloader: `python -m intristock_downloader`.

Fica à escuta do canal market_data_download (o backend faz NOTIFY ao criar um
pedido) e, por segurança, volta a olhar para a fila a cada poucos segundos.
"""

import logging
import signal
import sys
import time

import psycopg

from . import clickhouse
from .config import load_config
from .downloads import claim_next, open_connection, process, reset_interrupted

# Sem NOTIFY (ligação caída, pedido criado à mão), a fila é vista na mesma
POLL_SECONDS = 10
# Espera antes de voltar a ligar ao Postgres depois de a ligação cair
RECONNECT_SECONDS = 5

log = logging.getLogger("intristock_downloader")


def main() -> None:
    logging.basicConfig(
        level=logging.INFO,
        format="%(asctime)s %(levelname)s %(name)s: %(message)s",
        stream=sys.stdout,
    )
    config = load_config()

    ch = clickhouse.connect(config)
    clickhouse.migrate(ch)

    # Uma ligação só para o LISTEN (tem de ser autocommit) e outra para o trabalho
    def connect():
        listener = open_connection(config.postgres_conninfo, autocommit=True)
        listener.execute("LISTEN market_data_download")
        return listener, open_connection(config.postgres_conninfo)

    listener, conn = connect()
    reset_interrupted(conn)

    stopping = False

    def stop(*_):
        nonlocal stopping
        stopping = True
        log.info("A parar depois do pedido em curso")

    signal.signal(signal.SIGINT, stop)
    signal.signal(signal.SIGTERM, stop)

    log.info("Downloader pronto, à espera de pedidos")
    while not stopping:
        try:
            job = claim_next(conn)
            if job:
                process(conn, ch, job)
                continue

            # Dorme até chegar um NOTIFY ou passar o tempo do poll
            for _ in listener.notifies(timeout=POLL_SECONDS, stop_after=1):
                pass
        except psycopg.OperationalError as error:
            # O Postgres fechou a ligação (reinício, rede): volta a ligar. Um
            # pedido que estivesse a meio volta à fila
            log.warning("Ligação ao Postgres perdida (%s); a voltar a ligar", str(error).splitlines()[0])
            listener.close()
            conn.close()
            listener, conn = _reconnect(connect, lambda: stopping)
            if conn:
                reset_interrupted(conn)

    if conn:
        conn.close()
        listener.close()


def _reconnect(connect, is_stopping):
    """Tenta ligar até conseguir (ou até mandarem parar)."""
    while not is_stopping():
        time.sleep(RECONNECT_SECONDS)
        try:
            listener, conn = connect()
            log.info("Ligação ao Postgres de volta")
            return listener, conn
        except psycopg.OperationalError:
            continue
    return None, None


if __name__ == "__main__":
    main()

"""Arranque do downloader: `python -m intristock_downloader`.

Fica à escuta do canal market_data_download (o backend faz NOTIFY ao criar um
pedido) e, por segurança, volta a olhar para a fila a cada poucos segundos.

Correm `DOWNLOADER_WORKERS` pedidos ao mesmo tempo (3 por omissão), cada um
numa thread com as suas ligações; os limites de pedidos de cada corretora são
partilhados (`control.RateLimiter`), por isso mais trabalhadores não passam o
limite do IP: só deixam um pedido pequeno passar à frente de um de anos.

Ao parar (SIGTERM do systemd, Ctrl+C) os pedidos a meio voltam logo à fila e
os meses a meio ficam por descarregar: não se espera pelo fim (o systemd só dá
30 s).
"""

import logging
import os
import signal
import sys
import threading
import time

import psycopg

from . import clickhouse, control
from .config import load_config
from .downloads import claim_next, open_connection, process, requeue, reset_interrupted

# Sem NOTIFY (ligação caída, pedido criado à mão), a fila é vista na mesma
POLL_SECONDS = 10
# Espera antes de voltar a ligar ao Postgres depois de a ligação cair
RECONNECT_SECONDS = 5
# Quanto se espera pelos trabalhadores ao parar (o systemd mata aos 30 s)
STOP_GRACE_SECONDS = 20

log = logging.getLogger("intristock_downloader")


def _workers() -> int:
    configured = os.environ.get("DOWNLOADER_WORKERS")
    return max(1, int(configured)) if configured else 3


class Wakeup:
    """Acorda os trabalhadores que esperam por pedidos (um NOTIFY ou a ordem de parar)."""

    def __init__(self):
        self._condition = threading.Condition()
        self.generation = 0

    def notify(self) -> None:
        with self._condition:
            self.generation += 1
            self._condition.notify_all()

    def wait(self, seen: int, timeout: float) -> None:
        with self._condition:
            self._condition.wait_for(lambda: self.generation != seen or control.stopping.is_set(), timeout)


def _reconnect(connect):
    """Tenta ligar até conseguir (ou até mandarem parar)."""
    while not control.stopping.is_set():
        if control.stopping.wait(RECONNECT_SECONDS):
            break
        try:
            result = connect()
            log.info("Ligação ao Postgres de volta")
            return result
        except psycopg.OperationalError:
            continue
    return None


def _worker(number: int, config, wakeup: Wakeup) -> None:
    """Um trabalhador: apanha um pedido de cada vez até mandarem parar."""
    name = f"trabalhador {number}"
    connect = lambda: open_connection(config.postgres_conninfo)  # noqa: E731
    # As ligações de cada trabalhador (sem elas, tenta-se outra vez até mandarem parar)
    conn = ch = None
    while conn is None or ch is None:
        try:
            conn = conn or connect()
            ch = ch or clickhouse.connect(config)
        except Exception as error:  # noqa: BLE001
            log.warning("O %s não conseguiu ligar às bases (%s); a tentar outra vez", name, error)
            if control.stopping.wait(RECONNECT_SECONDS):
                if conn is not None:
                    conn.close()
                return
    job, current = None, {}
    while not control.stopping.is_set():
        try:
            seen = wakeup.generation
            job, current = claim_next(conn), {}
            if job:
                process(conn, ch, job, current)
                job = None
                continue
            job = None
            wakeup.wait(seen, POLL_SECONDS)
        except control.Stopped:
            break
        except psycopg.OperationalError as error:
            # O Postgres fechou a ligação (reinício, rede): volta a ligar. O pedido
            # que estivesse a meio volta à fila (só o deste trabalhador)
            log.warning("O %s perdeu a ligação ao Postgres (%s); a voltar a ligar", name,
                        str(error).splitlines()[0] if str(error) else error)
            conn.close()
            conn = _reconnect(connect)
            if conn is None:
                return
            if job:
                requeue(conn, job["id"], job["instrumentId"], current.get("month"))
                job = None
        except Exception:  # noqa: BLE001 — um erro inesperado não pode matar o trabalhador
            log.exception("Erro inesperado no %s", name)
            if job:
                try:
                    requeue(conn, job["id"], job["instrumentId"], current.get("month"))
                except Exception:  # noqa: BLE001
                    log.exception("Não foi possível devolver o pedido %s à fila", job["id"])
                job = None
            control.stopping.wait(RECONNECT_SECONDS)
            if conn.closed:
                conn = _reconnect(connect)
                if conn is None:
                    return
    conn.close()


def main() -> None:
    logging.basicConfig(
        level=logging.INFO,
        format="%(asctime)s %(levelname)s %(name)s: %(threadName)s: %(message)s",
        stream=sys.stdout,
    )
    config = load_config()

    clickhouse.migrate(clickhouse.connect(config))

    # A ligação do LISTEN tem de ser autocommit; os trabalhadores têm as suas
    def listen():
        listener = open_connection(config.postgres_conninfo, autocommit=True)
        listener.execute("LISTEN market_data_download")
        return listener

    listener = listen()
    reset_interrupted(listener)

    wakeup = Wakeup()

    def stop(*_):
        if not control.stopping.is_set():
            log.info("A parar: os pedidos a meio voltam à fila")
        control.stopping.set()
        wakeup.notify()

    signal.signal(signal.SIGINT, stop)
    signal.signal(signal.SIGTERM, stop)

    count = _workers()
    threads = [
        threading.Thread(target=_worker, args=(number, config, wakeup), name=f"worker-{number}", daemon=True)
        for number in range(1, count + 1)
    ]
    for thread in threads:
        thread.start()

    log.info("Downloader pronto (%s pedidos ao mesmo tempo), à espera de pedidos", count)
    while not control.stopping.is_set():
        try:
            # Acorda os trabalhadores a cada NOTIFY (e vê de segundo a segundo se é para parar)
            for _ in listener.notifies(timeout=1, stop_after=1):
                wakeup.notify()
        except psycopg.OperationalError as error:
            log.warning("Ligação de escuta ao Postgres perdida (%s); a voltar a ligar", str(error).splitlines()[0])
            listener.close()
            listener = _reconnect(listen)
            if listener is None:
                break
            wakeup.notify()

    deadline = time.monotonic() + STOP_GRACE_SECONDS
    for thread in threads:
        thread.join(max(0.0, deadline - time.monotonic()))
    if listener is not None:
        listener.close()


if __name__ == "__main__":
    main()

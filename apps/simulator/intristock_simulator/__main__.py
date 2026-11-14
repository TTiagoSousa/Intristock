"""Arranque do simulador: `python -m intristock_simulator`.

O processo principal só gere a fila: escuta os canais simulation_run (o backend
criou uma simulação) e market_data_download_done (o downloader acabou umas
velas) e entrega cada simulação a um processo do conjunto. Várias simulações
correm ao mesmo tempo, uma por processo; as que sobram esperam na fila.

Ao lado corre o processo dos testes ao vivo (`live`), que o principal volta a
arrancar se morrer.
"""

import logging
import multiprocessing
import os
import signal
import time
from concurrent.futures import Future, ProcessPoolExecutor
from concurrent.futures.process import BrokenProcessPool

import psycopg

from .infra import clickhouse
from .infra.config import load_config
from .infra.db import open_connection
from .live import main as live_main
from .worker.runs import (
    child_init, claim_next, execute, fail, fail_without_candles, requeue, reset_interrupted, setup_logging,
)

# Sem NOTIFY (ligação caída, pedido criado à mão), a fila é vista na mesma
POLL_SECONDS = 10
# Espera antes de voltar a ligar ao Postgres depois de a ligação cair
RECONNECT_SECONDS = 5
# Uma simulação que estava num conjunto de processos que morreu volta à fila;
# à segunda vez (já a correr sozinha) é dela, e falha
MAX_CRASHES = 2
CRASH_MESSAGE = ("O simulador ficou sem memória (ou o processo morreu) a correr esta simulação. "
                 "Experimenta um período mais curto ou um tempo gráfico maior.")

log = logging.getLogger("intristock_simulator")


def _processes() -> int:
    # Um núcleo fica livre para o resto da VM (backend, Postgres, downloader)
    configured = os.environ.get("SIMULATOR_PROCESSES")
    if configured:
        return max(1, int(configured))
    return max(1, (os.cpu_count() or 2) - 1)


def _start_live() -> multiprocessing.Process:
    process = multiprocessing.get_context("spawn").Process(target=live_main, name="intristock-live", daemon=True)
    process.start()
    return process


def _new_pool(processes: int) -> ProcessPoolExecutor:
    return ProcessPoolExecutor(
        max_workers=processes,
        mp_context=multiprocessing.get_context("spawn"),
        initializer=child_init,
    )


def main() -> None:
    setup_logging()
    config = load_config()

    # As migrations correm uma vez, aqui, antes de haver filhos
    clickhouse.migrate(clickhouse.connect(config))

    # O LISTEN tem de ser numa ligação autocommit
    def connect():
        listener = open_connection(config.postgres_conninfo, autocommit=True)
        listener.execute("LISTEN simulation_run")
        listener.execute("LISTEN market_data_download_done")
        return listener, open_connection(config.postgres_conninfo)

    listener, conn = connect()
    reset_interrupted(conn)

    processes = _processes()
    pool = _new_pool(processes)
    # Que simulação está em cada processo, para a marcar se o processo morrer
    running: dict[Future, str] = {}
    # As que estavam num conjunto que morreu: correm sozinhas, para se saber se a culpa é delas
    crashes: dict[str, int] = {}

    stopping = False

    def stop(*_):
        nonlocal stopping
        stopping = True
        log.info("A parar depois das simulações em curso")

    signal.signal(signal.SIGINT, stop)
    signal.signal(signal.SIGTERM, stop)

    live = _start_live()

    log.info("Simulador pronto (até %s em paralelo), à espera de simulações", processes)
    while not stopping:
        try:
            if not live.is_alive():
                log.error("O processo dos testes ao vivo terminou (%s); a arrancar outro", live.exitcode)
                live = _start_live()
            broken = False
            for future in [future for future in running if future.done()]:
                run_id = running[future]
                error = future.exception()
                if isinstance(error, BrokenProcessPool):
                    # Um processo morreu (memória, por exemplo) e levou o conjunto: trata-se em baixo
                    broken = True
                    continue
                if error:
                    # O execute já trata os erros da simulação; isto é uma falha fora dele
                    log.error("A simulação %s falhou fora do execute: %s", run_id, error)
                    fail(conn, run_id, CRASH_MESSAGE)
                crashes.pop(run_id, None)
                running.pop(future)

            # Um processo que morre estraga o conjunto todo e não se sabe qual foi:
            # as que lá estavam voltam à fila e correm sozinhas; à segunda, falham
            if broken:
                for future, run_id in list(running.items()):
                    crashes[run_id] = crashes.get(run_id, 0) + 1
                    if crashes[run_id] >= MAX_CRASHES:
                        log.error("A simulação %s matou o processo outra vez; fica falhada", run_id)
                        fail(conn, run_id, CRASH_MESSAGE)
                        crashes.pop(run_id)
                    else:
                        log.warning("O processo da simulação %s morreu; volta à fila para correr sozinha", run_id)
                        requeue(conn, run_id)
                    running.pop(future)
                pool.shutdown(wait=False, cancel_futures=True)
                pool = _new_pool(processes)

            fail_without_candles(conn)
            # Uma suspeita corre sozinha: enquanto corre, não se apanha mais nenhuma
            while len(running) < processes and not any(run_id in crashes for run_id in running.values()):
                run_id = claim_next(conn)
                if not run_id:
                    break
                if run_id in crashes and running:
                    # Espera que as outras acabem (é a mais antiga da fila, apanha-se outra vez)
                    requeue(conn, run_id)
                    break
                running[pool.submit(execute, run_id)] = run_id

            # Com simulações a correr, acorda mais vezes para ver se acabaram
            timeout = 1 if running else POLL_SECONDS
            for _ in listener.notifies(timeout=timeout, stop_after=1):
                pass
        except psycopg.OperationalError as error:
            # O Postgres fechou a ligação (reinício, rede): volta a ligar. As
            # simulações em curso têm as suas ligações e continuam
            log.warning("Ligação ao Postgres perdida (%s); a voltar a ligar", str(error).splitlines()[0])
            listener.close()
            conn.close()
            listener, conn = _reconnect(connect, lambda: stopping)

    live.terminate()
    pool.shutdown(wait=True)
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

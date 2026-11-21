"""A fila das simulações (SimulationRun) e a execução de cada uma.

Uma simulação só é apanhada depois de o download das suas velas acabar. A
execução corre num processo à parte (ver __main__), que abre as suas próprias
ligações: as do processo principal não passam para os filhos.
"""

import json
import logging
import os
import signal
import sys
import time
from datetime import datetime, timezone

import psycopg
from psycopg.types.json import Jsonb

from ..infra import clickhouse
from .. import factsheet
from ..market.candles import load_funding, load_minutes, to_bars
from ..infra.config import load_config
from ..infra.db import open_connection
from ..engine import NoCandlesError, run

log = logging.getLogger(__name__)

# O progresso grava-se no máximo de tanto em tanto tempo (e só se mudou)
PROGRESS_EVERY_SECONDS = 0.5

# Parte da barra para cada fase: ler as velas, calcular, gravar
LOADED_AT = 10
SIMULATED_AT = 95

# O tempo máximo de uma simulação (minutos; `SIMULATION_MAX_MINUTES` muda-o)
MAX_RUN_SECONDS = max(1, int(os.environ.get("SIMULATION_MAX_MINUTES") or 120)) * 60
# De quanto em quanto tempo se vê se mandaram cancelar
CANCEL_CHECK_SECONDS = 3

# O que o utilizador lê quando a falha não é das que se explicam (o detalhe fica no registo)
INTERNAL_ERROR = "A simulação falhou por um erro do simulador. Corre-a outra vez; se voltar a falhar, avisa o administrador."


class RunCancelled(Exception):
    """O utilizador mandou cancelar (o backend pôs `cancelling`)."""


class RunTimedOut(Exception):
    """A simulação passou o tempo máximo."""

TRADE_COLUMNS = (
    '"runId"',
    '"index"',
    '"entryRule"',
    "side",
    '"entryTime"',
    '"entryPrice"',
    '"exitTime"',
    '"exitPrice"',
    '"exitReason"',
    '"exitRule"',
    "quantity",
    "pnl",
    '"pnlPct"',
    "fees",
    "equity",
    "funding",
    '"maePct"',
    '"mfePct"',
    "bars",
    "partials",
    "adds",
    '"stopMoves"',
)


def reset_interrupted(conn: psycopg.Connection) -> None:
    """Simulações que ficaram a meio (o simulador foi reiniciado) voltam à fila;
    as que tinham mandado cancelar ficam canceladas."""
    with conn.transaction():
        conn.execute(
            """UPDATE "SimulationRun" SET status = 'cancelled', error = NULL, "finishedAt" = now()
               WHERE status = 'cancelling'"""
        )
        result = conn.execute(
            """UPDATE "SimulationRun" SET status = 'queued', progress = 0, "progressInfo" = NULL, "startedAt" = NULL
               WHERE status = 'running'"""
        )
    if result.rowcount:
        log.info("%s simulação(ões) interrompida(s) voltaram à fila", result.rowcount)


def requeue(conn: psycopg.Connection, run_id: str) -> None:
    """Uma simulação que estava a correr volta à fila (o processo dela morreu);
    se entretanto a mandaram cancelar, fica cancelada."""
    with conn.transaction():
        conn.execute(
            """UPDATE "SimulationRun"
                  SET status = CASE WHEN status = 'cancelling' THEN 'cancelled' ELSE 'queued' END,
                      progress = 0, "progressInfo" = NULL, "startedAt" = NULL,
                      "finishedAt" = CASE WHEN status = 'cancelling' THEN now() ELSE NULL END
                WHERE id = %s AND status IN ('running', 'cancelling')""",
            (run_id,),
        )


def fail_without_candles(conn: psycopg.Connection) -> None:
    """As que esperavam por um download que falhou já não vão ter velas."""
    with conn.transaction():
        conn.execute(
            """
            UPDATE "SimulationRun" r
               SET status = 'failed', "finishedAt" = now(),
                   error = 'O download das velas falhou: ' || coalesce(d.error, '')
              FROM "MarketDataDownload" d
             WHERE d.id = r."downloadId" AND r.status = 'queued' AND d.status = 'failed'
            """
        )


def claim_next(conn: psycopg.Connection) -> str | None:
    # SKIP LOCKED: com vários simuladores, cada um apanha uma simulação diferente
    with conn.transaction():
        row = conn.execute(
            """
            UPDATE "SimulationRun"
               SET status = 'running', progress = 0, "progressInfo" = NULL, "startedAt" = now()
             WHERE id = (
                   SELECT r.id FROM "SimulationRun" r
                     JOIN "MarketDataDownload" d ON d.id = r."downloadId"
                    WHERE r.status = 'queued' AND d.status = 'done'
                    ORDER BY r."createdAt"
                    FOR UPDATE OF r SKIP LOCKED
                    LIMIT 1
             )
            RETURNING id
            """
        ).fetchone()
    return row["id"] if row else None


def _utc(value: datetime) -> datetime:
    # As colunas do Prisma são timestamp sem fuso, sempre em UTC
    return value.replace(tzinfo=timezone.utc) if value.tzinfo is None else value


def _naive(ms: int) -> datetime:
    return datetime.fromtimestamp(ms / 1000, tz=timezone.utc).replace(tzinfo=None)


def _load_run(conn: psycopg.Connection, run_id: str) -> dict:
    return conn.execute(
        """
        SELECT r.id, r."instrumentId", r.timeframe, r."fromDate", r."toDate", r.strategy,
               d."fromDate" AS "dataFromDate", i.symbol, i.type AS "instrumentType"
          FROM "SimulationRun" r
          JOIN "MarketDataDownload" d ON d.id = r."downloadId"
          JOIN "Instrument" i ON i.id = r."instrumentId"
         WHERE r.id = %s
        """,
        (run_id,),
    ).fetchone()


def _set_progress(conn: psycopg.Connection, run_id: str, progress: int, info: dict | None = None) -> None:
    with conn.transaction():
        if info is None:
            conn.execute('UPDATE "SimulationRun" SET progress = %s WHERE id = %s', (progress, run_id))
        else:
            conn.execute(
                'UPDATE "SimulationRun" SET progress = %s, "progressInfo" = %s WHERE id = %s',
                (progress, Jsonb(info), run_id),
            )


def _save(conn: psycopg.Connection, run_id: str, trades, summary: dict, report: dict) -> None:
    # Os trades e o "concluída" entram juntos: ou fica tudo, ou nada
    with conn.transaction():
        with conn.cursor() as cursor:
            with cursor.copy(f'COPY "SimulationTrade" ({", ".join(TRADE_COLUMNS)}) FROM STDIN') as copy:
                for index, trade in enumerate(trades, start=1):
                    copy.write_row(
                        (
                            run_id,
                            index,
                            trade.entry_rule,
                            trade.side,
                            _naive(trade.entry_time),
                            trade.entry_price,
                            _naive(trade.exit_time),
                            trade.exit_price,
                            trade.exit_reason,
                            trade.exit_rule,
                            trade.quantity,
                            trade.pnl,
                            trade.pnl_pct,
                            trade.fees,
                            trade.equity,
                            trade.funding,
                            trade.mae_pct,
                            trade.mfe_pct,
                            trade.bars,
                            # As saídas parciais em JSON (o COPY em texto lê-o para o JSONB)
                            json.dumps(trade.partials) if trade.partials else None,
                            json.dumps(trade.adds) if trade.adds else None,
                            json.dumps(trade.stop_moves) if trade.stop_moves else None,
                        )
                    )
        # Cada bloco do relatório na sua coluna (os nomes são fixos, de REPORT_COLUMNS)
        blocks = "".join(f', "{column}" = %s' for column in factsheet.REPORT_COLUMNS)
        conn.execute(
            f"""UPDATE "SimulationRun"
                  SET status = 'done', progress = 100, result = %s{blocks}, error = NULL, "finishedAt" = now()
                WHERE id = %s""",
            (Jsonb(summary), *[Jsonb(report.get(column)) for column in factsheet.REPORT_COLUMNS], run_id),
        )


def fail(conn: psycopg.Connection, run_id: str, message: str) -> None:
    """Marca a simulação como falhada; se a tinham mandado cancelar, fica cancelada."""
    with conn.transaction():
        conn.execute(
            """UPDATE "SimulationRun"
                  SET status = CASE WHEN status = 'cancelling' THEN 'cancelled' ELSE 'failed' END,
                      error = CASE WHEN status = 'cancelling' THEN NULL ELSE %s END,
                      "finishedAt" = now()
                WHERE id = %s""",
            (message[:500], run_id),
        )


def cancelled(conn: psycopg.Connection, run_id: str) -> None:
    with conn.transaction():
        conn.execute(
            """UPDATE "SimulationRun" SET status = 'cancelled', error = NULL, "finishedAt" = now()
                WHERE id = %s""",
            (run_id,),
        )


def _status(conn: psycopg.Connection, run_id: str) -> str | None:
    row = conn.execute('SELECT status FROM "SimulationRun" WHERE id = %s', (run_id,)).fetchone()
    return row["status"] if row else None


def setup_logging() -> None:
    logging.basicConfig(
        level=logging.INFO,
        format="%(asctime)s %(levelname)s %(name)s: %(message)s",
        stream=sys.stdout,
    )


def child_init() -> None:
    """Arranque de cada processo filho. Vive aqui e não no __main__: com
    'spawn', o filho só encontra funções de módulos que consegue importar."""
    # O Ctrl+C chega a todos os processos; quem decide parar é o principal,
    # que para os filhos e devolve as simulações deles à fila
    signal.signal(signal.SIGINT, signal.SIG_IGN)
    setup_logging()


def execute(run_id: str) -> None:
    """Corre uma simulação de princípio ao fim. É o que cada processo filho faz."""
    config = load_config()
    # Autocommit: cada `with conn.transaction()` é uma transação a sério. Sem
    # ele, a primeira leitura abria uma transação que nunca era confirmada
    conn = open_connection(config.postgres_conninfo, autocommit=True)
    try:
        job = _load_run(conn, run_id)
        log.info("Simulação %s: %s %s", run_id, job["symbol"], job["timeframe"])
        started = time.monotonic()
        checked = {"at": started}

        def check() -> None:
            """Para se mandaram cancelar ou se passou o tempo máximo (de tanto em tanto tempo)."""
            now = time.monotonic()
            if now - started > MAX_RUN_SECONDS:
                raise RunTimedOut()
            if now - checked["at"] >= CANCEL_CHECK_SECONDS:
                checked["at"] = now
                if _status(conn, run_id) != "running":
                    raise RunCancelled()
        _set_progress(conn, run_id, 0, {"phase": "loading"})

        ch = clickhouse.connect(config)
        minutes = load_minutes(ch, job["instrumentId"], _utc(job["dataFromDate"]), _utc(job["toDate"]))
        bars = to_bars(minutes, job["timeframe"])
        # O funding histórico só existe nos perpétuos (o downloader traz-o com as velas)
        funding = None
        if job["instrumentType"] == "perpetual" and (job["strategy"].get("funding") or {}).get("mode") == "historical":
            funding = load_funding(ch, job["instrumentId"], _utc(job["dataFromDate"]), _utc(job["toDate"]))
        check()
        _set_progress(conn, run_id, LOADED_AT, {"phase": "simulating", "bars": len(bars)})

        last = {"progress": LOADED_AT, "at": time.monotonic(), "step": ("simulating", None)}

        def on_progress(fraction: float, info: dict | None = None) -> None:
            check()
            progress = LOADED_AT + int(fraction * (SIMULATED_AT - LOADED_AT))
            now = time.monotonic()
            # Uma fase ou secção nova grava-se logo; o resto no máximo de tanto em tanto tempo
            step = (info or {}).get("phase"), (info or {}).get("section")
            if step != last["step"] or (progress >= last["progress"] and now - last["at"] >= PROGRESS_EVERY_SECONDS):
                _set_progress(conn, run_id, max(progress, last["progress"]), info)
                last.update(progress=max(progress, last["progress"]), at=now, step=step)

        start_ms = int(_utc(job["fromDate"]).timestamp() * 1000)
        trades, summary, report = run(
            bars, minutes, job["strategy"], start_ms, on_progress, job["timeframe"], funding
        )
        _set_progress(conn, run_id, SIMULATED_AT, {"phase": "saving", "bars": len(bars), "trades": len(trades)})
        _save(conn, run_id, trades, summary, report)

        log.info(
            "Simulação %s concluída: %s trades, %.2f%% em %.1fs",
            run_id,
            len(trades),
            summary["netProfitPct"],
            time.monotonic() - started,
        )
    except NoCandlesError as error:
        fail(conn, run_id, str(error))
    except RunCancelled:
        log.info("Simulação %s cancelada", run_id)
        cancelled(conn, run_id)
    except RunTimedOut:
        log.warning("Simulação %s parada: passou %s min", run_id, MAX_RUN_SECONDS // 60)
        fail(conn, run_id, f"A simulação passou o tempo máximo ({MAX_RUN_SECONDS // 60} min) e foi parada. "
                           "Experimenta um período mais curto ou uma estratégia mais simples.")
    except Exception:  # noqa: BLE001 — qualquer falha marca a simulação
        # O detalhe técnico fica no registo; o utilizador lê uma mensagem que se percebe
        log.exception("Simulação %s falhou", run_id)
        fail(conn, run_id, INTERNAL_ERROR)
    finally:
        conn.close()

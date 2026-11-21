"""Os testes ao vivo (`LiveTest`): um processo à parte do simulador, com um ciclo
asyncio onde vivem todos os testes.

- Escuta o canal `live_test` (o backend criou ou mandou parar um teste) e, sem
  aviso, vê a tabela de tempos a tempos.
- Cada mercado tem uma ligação WebSocket à corretora, partilhada pelos testes
  dele (`Feed`); cada teste recebe a vela do minuto a decorrer a cada negócio.
  Enquanto o teste está ocupado (o motor a correr), as atualizações do mesmo
  minuto juntam-se numa só, a última (`Mailbox`): nada se perde e a fila não
  enche.
- A cada minuto novo o motor corre outra vez, num processo do conjunto do motor
  (`ENGINE_PROCESSES`; um processo não fica preso ao GIL dos outros testes nem
  do WebSocket), e os registos novos gravam-se em `LiveTestEvent`; o estado
  (capital, posições, trades, condições) fica em `LiveTest.state`. As velas e o
  funding (rede, ClickHouse) vão buscar-se em threads.
- O backend é avisado pelo canal `live_test_event` (os registos, o estado e o
  preço, este no máximo de `TICK_SECONDS` em `TICK_SECONDS`) e passa ao browser.
- Uma ligação que cai volta a ligar sozinha, e os minutos que faltaram vêm por
  REST; depois de um reinício os testes continuam onde iam (a memória dos
  registos grava-se com o estado).
- O Postgres em baixo (um reinício, uma atualização) não mata os testes: cada
  pedido espera que ele volte, volta a ligar e repete-se.
"""

from __future__ import annotations

import asyncio
import collections
import json
import logging
import multiprocessing
import os
import signal
import sys
import time
from concurrent.futures import ProcessPoolExecutor, ThreadPoolExecutor
from concurrent.futures.process import BrokenProcessPool
from datetime import datetime, timezone

import numpy as np
import psycopg
from psycopg.rows import dict_row
from psycopg.types.json import Jsonb

from ..infra import clickhouse
from ..infra.config import load_config
from ..market.candles import Candles, load_funding, load_minutes
from ..worker.runs import child_init, setup_logging
from .bot import LiveBot, rerun_in_process
from .exchanges import MINUTE_MS, Instrument, Minute, fetch_funding, fetch_minutes, stream_minutes

log = logging.getLogger("intristock_simulator.live")

ACTIVE = ("waiting", "running", "stopping")
# Sem aviso do backend, a tabela vê-se na mesma de tanto em tanto tempo
POLL_SECONDS = 15
# O preço vai para o browser no máximo de tanto em tanto tempo
TICK_SECONDS = 0.5
# Espera antes de voltar a ligar à corretora (dobra a cada falha, até ao máximo)
RECONNECT_SECONDS = 2
RECONNECT_MAX_SECONDS = 60
# Um minuto da Coinbase sem negócios fecha-se passado este tempo
QUIET_GRACE_MS = 5_000
# Os avisos do Postgres têm um limite de 8000 bytes: acima, o browser vai buscar
NOTIFY_LIMIT = 7_500
# Os registos gravam-se aos blocos de tantos (um INSERT cada)
INSERT_BATCH = 500
# O funding dos perpétuos vê-se outra vez de hora a hora
FUNDING_REFRESH_SECONDS = 3600
# O que o utilizador lê quando o teste falha por um erro do simulador
LIVE_INTERNAL_ERROR = "O teste parou por um erro do simulador. Começa um teste novo; se voltar a falhar, avisa o administrador."
# Com o Postgres em baixo, volta-se a tentar ligar (dobra a cada falha, até ao máximo)
DB_RETRY_SECONDS = 2
DB_RETRY_MAX_SECONDS = 30


def _engine_processes() -> int:
    """Os processos do motor dos testes ao vivo (`LIVE_ENGINE_PROCESSES`; por
    omissão metade dos núcleos, entre 1 e 4)."""
    configured = os.environ.get("LIVE_ENGINE_PROCESSES")
    if configured:
        return max(1, int(configured))
    return max(1, min(4, (os.cpu_count() or 2) // 2))


def _ms(value: datetime | None) -> int | None:
    if value is None:
        return None
    if value.tzinfo is None:
        value = value.replace(tzinfo=timezone.utc)
    return int(value.timestamp() * 1000)


def _naive(ms: int) -> datetime:
    return datetime.fromtimestamp(ms / 1000, tz=timezone.utc).replace(tzinfo=None)


def _now_ms() -> int:
    return int(time.time() * 1000)


class Mailbox:
    """O que chega da ligação para um teste, por ordem. Uma vela do mesmo minuto
    que a última por ler substitui-a (só conta o estado mais recente de cada
    minuto), por isso, com o teste ocupado, fica no máximo uma por minuto e
    nenhuma se perde (o `asyncio.Queue` com limite deitava fora as novas)."""

    def __init__(self):
        self._items: collections.deque = collections.deque()
        self._ready = asyncio.Event()

    def put_nowait(self, item) -> None:
        kind, value = item
        if kind == "minute" and self._items:
            last_kind, last_value = self._items[-1]
            if last_kind == "minute" and last_value.time == value.time:
                self._items[-1] = item
                return
        self._items.append(item)
        self._ready.set()

    async def get(self):
        while not self._items:
            self._ready.clear()
            await self._ready.wait()
        return self._items.popleft()

    def qsize(self) -> int:
        return len(self._items)


class Feed:
    """A ligação WebSocket de um mercado, partilhada pelos testes dele."""

    def __init__(self, instrument: Instrument):
        self.instrument = instrument
        self.queues: set[Mailbox] = set()
        self.task: asyncio.Task | None = None
        self.connected = False

    def subscribe(self) -> Mailbox:
        queue = Mailbox()
        self.queues.add(queue)
        if self.task is None:
            self.task = asyncio.create_task(self._run())
        elif self.connected:
            # Um teste que chega com a ligação já aberta (a de outro teste do mesmo mercado)
            queue.put_nowait(("connected", None))
        return queue

    def unsubscribe(self, queue: Mailbox) -> None:
        self.queues.discard(queue)
        if not self.queues and self.task:
            self.task.cancel()
            self.task = None

    def _send(self, item) -> None:
        for queue in list(self.queues):
            queue.put_nowait(item)

    async def _run(self) -> None:
        delay = RECONNECT_SECONDS
        while True:
            connected = False
            try:
                async for minute in stream_minutes(self.instrument):
                    if not connected:
                        connected = self.connected = True
                        delay = RECONNECT_SECONDS
                        self._send(("connected", None))
                    self._send(("minute", minute))
                # A corretora fechou a ligação (a Binance fá-lo de 24 em 24 h)
                self.connected = False
                self._send(("disconnected", "closed"))
            except asyncio.CancelledError:
                raise
            except Exception as error:  # noqa: BLE001 — qualquer falha da ligação volta a ligar
                log.warning("Ligação a %s caiu: %s", self.instrument.key, error)
                self.connected = False
                self._send(("disconnected", str(error)[:200]))
            await asyncio.sleep(delay)
            delay = min(delay * 2, RECONNECT_MAX_SECONDS)


class Service:
    def __init__(self, config):
        self.config = config
        self.conn: psycopg.AsyncConnection | None = None
        self.feeds: dict[str, Feed] = {}
        self.tasks: dict[str, asyncio.Task] = {}
        # As velas e o funding (rede, ClickHouse) em threads; o motor num conjunto de processos
        self.pool = ThreadPoolExecutor(max_workers=4, thread_name_prefix="live-io")
        self.engine_processes = _engine_processes()
        self.engine_pool = self._new_engine_pool()
        self.wake = asyncio.Event()
        self.stopping = False
        # Só um volta a ligar de cada vez (os testes partilham a ligação)
        self.reconnecting = asyncio.Lock()

    def _new_engine_pool(self) -> ProcessPoolExecutor:
        return ProcessPoolExecutor(
            max_workers=self.engine_processes,
            mp_context=multiprocessing.get_context("spawn"),
            initializer=child_init,
        )

    async def _run_engine(self, bot: LiveBot, now_ms: int, final: bool) -> list[dict]:
        """O `rerun` do bot num processo do motor. Se o conjunto partir (um processo
        morreu), faz-se outro e tenta-se uma vez mais; à segunda, o erro sobe."""
        loop = asyncio.get_running_loop()
        for attempt in range(2):
            pool = self.engine_pool
            try:
                events, result = await loop.run_in_executor(pool, rerun_in_process, bot, now_ms, final)
            except BrokenProcessPool:
                if attempt:
                    raise
                log.warning("O conjunto do motor dos testes ao vivo partiu; a fazer outro")
                if self.engine_pool is pool:
                    pool.shutdown(wait=False, cancel_futures=True)
                    self.engine_pool = self._new_engine_pool()
                continue
            bot.apply_engine_result(result)
            return events
        return []

    # --- base de dados -------------------------------------------------------
    async def connect(self) -> None:
        self.conn = await psycopg.AsyncConnection.connect(
            self.config.postgres_conninfo, autocommit=True, row_factory=dict_row
        )

    async def _execute(self, query: str, params=None) -> psycopg.AsyncCursor:
        """Um pedido ao Postgres. Se a ligação caiu, espera que ele volte, volta a
        ligar e repete (um INSERT que chegou a entrar antes de cair pode ficar
        repetido); os outros erros sobem."""
        while True:
            conn = self.conn
            try:
                return await conn.execute(query, params)
            except (psycopg.OperationalError, psycopg.InterfaceError) as error:
                if not conn.closed or self.stopping:
                    raise
                log.warning("Postgres em baixo (%s); a voltar a ligar", str(error).splitlines()[0] if str(error) else error)
                await self._reconnect(conn)

    async def _reconnect(self, broken: psycopg.AsyncConnection) -> None:
        async with self.reconnecting:
            if self.conn is not broken:
                return  # outro teste já voltou a ligar
            delay = DB_RETRY_SECONDS
            while True:
                try:
                    await self.connect()
                    log.info("Ligação ao Postgres de volta")
                    return
                except psycopg.OperationalError:
                    await asyncio.sleep(delay)
                    delay = min(delay * 2, DB_RETRY_MAX_SECONDS)

    async def _notify(self, payload: dict) -> None:
        text = json.dumps(payload, separators=(",", ":"), default=float)
        if len(text) > NOTIFY_LIMIT:
            text = json.dumps({"id": payload["id"], "type": payload["type"], "refetch": True})
        await self._execute("SELECT pg_notify('live_test_event', %s)", (text,))

    async def _log(self, test_id: str, events: list[dict]) -> None:
        """Grava os registos e avisa o backend (o browser junta-os à lista)."""
        if not events:
            return
        # Um só INSERT (sem transação à volta: os testes partilham a ligação e
        # duas transações ao mesmo tempo nela não podem ser)
        rows = []
        for start in range(0, len(events), INSERT_BATCH):
            batch = events[start:start + INSERT_BATCH]
            values = ", ".join(["(%s, %s, %s, %s)"] * len(batch))
            params = [
                value
                for item in batch
                for value in (test_id, _naive(item["time"]), item["kind"], Jsonb(item["data"]))
            ]
            cursor = await self._execute(
                f'INSERT INTO "LiveTestEvent" ("testId", time, kind, data) VALUES {values} RETURNING id', params
            )
            ids = [row["id"] for row in await cursor.fetchall()]
            rows += [
                {"id": str(row_id), "time": item["time"], "kind": item["kind"], "data": item["data"]}
                for row_id, item in zip(ids, batch)
            ]
        await self._notify({"id": test_id, "type": "events", "events": rows})

    async def _system(self, test_id: str, code: str, **data) -> None:
        await self._log(test_id, [{"time": _now_ms(), "kind": "system", "data": {"code": code, **data}}])

    async def _save_state(self, bot: LiveBot) -> None:
        await self._execute(
            'UPDATE "LiveTest" SET state = %s, memory = %s, "updatedAt" = now() WHERE id = %s',
            (Jsonb(bot.state), Jsonb(bot.memory), bot.id),
        )
        await self._notify({"id": bot.id, "type": "state"})

    async def _set_status(self, test_id: str, status: str, error: str | None = None) -> None:
        extra = ""
        if status == "running":
            extra = ', "startedAt" = coalesce("startedAt", now())'
        elif status in ("stopped", "finished", "failed"):
            extra = ', "finishedAt" = now()'
        await self._execute(
            f'UPDATE "LiveTest" SET status = %s, error = %s, "updatedAt" = now(){extra} WHERE id = %s',
            (status, error, test_id),
        )
        await self._notify({"id": test_id, "type": "status", "status": status})

    async def _load_tests(self) -> list[dict]:
        cursor = await self._execute(
            """SELECT t.id, t.status, t.timeframe, t.strategy, t."startAt", t."endAt", t."dataFromDate", t.memory,
                      i.id AS "instrumentId", i.source, i.type, i.symbol
                 FROM "LiveTest" t JOIN "Instrument" i ON i.id = t."instrumentId"
                WHERE t.status = ANY(%s)""",
            (list(ACTIVE),),
        )
        return await cursor.fetchall()

    async def _status_of(self, test_id: str) -> str | None:
        cursor = await self._execute('SELECT status FROM "LiveTest" WHERE id = %s', (test_id,))
        row = await cursor.fetchone()
        return row["status"] if row else None

    # --- o ciclo ---------------------------------------------------------------
    async def sync(self) -> None:
        """Arranca os testes novos e deixa os que já não estão ativos."""
        tests = await self._load_tests()
        wanted = {test["id"]: test for test in tests}
        for test_id, task in list(self.tasks.items()):
            if task.done():
                self.tasks.pop(test_id)
                error = task.exception() if not task.cancelled() else None
                if error:
                    # O detalhe técnico fica no registo; o utilizador lê uma mensagem que se percebe
                    log.error("O teste ao vivo %s falhou", test_id, exc_info=error)
                    await self._set_status(test_id, "failed", LIVE_INTERNAL_ERROR)
                    wanted.pop(test_id, None)
            elif test_id not in wanted:
                task.cancel()
        for test_id, test in wanted.items():
            if test_id not in self.tasks:
                self.tasks[test_id] = asyncio.create_task(self._run_test(test))

    async def _run_test(self, test: dict) -> None:
        instrument = Instrument(str(test["instrumentId"]), test["source"], test["type"], test["symbol"])
        start_ms = _ms(test["startAt"])
        end_ms = _ms(test["endAt"])
        bot = LiveBot(
            {"id": test["id"], "strategy": test["strategy"], "timeframe": test["timeframe"],
             "start_ms": start_ms, "end_ms": end_ms},
            test["memory"],
        )
        if test["status"] == "stopping":
            # Mandado parar antes de começar (ou durante um reinício)
            await self._set_status(bot.id, "stopped")
            return

        # À espera do início (o aquecimento vem na altura)
        if test["status"] == "waiting":
            if _now_ms() < start_ms:
                await self._system(bot.id, "waiting", startAt=start_ms)
            while _now_ms() < start_ms:
                await asyncio.sleep(min(30, (start_ms - _now_ms()) / 1000))
                if await self._status_of(bot.id) != "waiting":
                    break
            if await self._status_of(bot.id) == "stopping":
                await self._set_status(bot.id, "stopped")
                return
            await self._set_status(bot.id, "running")
            await self._system(bot.id, "starting")
        else:
            await self._system(bot.id, "resuming")

        loop = asyncio.get_running_loop()
        data_from = _ms(test["dataFromDate"])
        now_minute = _now_ms() // MINUTE_MS * MINUTE_MS
        history = await loop.run_in_executor(self.pool, self._history, instrument, data_from, now_minute)
        bot.add_closed_arrays(history.time, history.open, history.high, history.low, history.close, history.volume)
        await self._system(bot.id, "history", minutes=len(history))
        if self._wants_funding(bot, instrument):
            bot.funding = await loop.run_in_executor(self.pool, self._funding, instrument, data_from, _now_ms())

        feed = self.feeds.get(instrument.key)
        if feed is None:
            feed = self.feeds[instrument.key] = Feed(instrument)
        queue = feed.subscribe()
        try:
            await self._rerun(bot)
            await self._follow(bot, instrument, queue)
        finally:
            feed.unsubscribe(queue)

    async def _follow(self, bot: LiveBot, instrument: Instrument, queue: Mailbox) -> None:
        loop = asyncio.get_running_loop()
        last_tick = 0.0
        last_status_check = time.monotonic()
        last_funding = time.monotonic()
        while True:
            try:
                kind, value = await asyncio.wait_for(queue.get(), timeout=2)
            except TimeoutError:
                kind, value = "idle", None

            if kind == "minute":
                if bot.on_minute(value):
                    await self._rerun(bot)
                if time.monotonic() - last_tick >= TICK_SECONDS:
                    last_tick = time.monotonic()
                    payload, touches = bot.tick()
                    for item in touches:
                        item["time"] = _now_ms()
                    await self._log(bot.id, touches)
                    await self._notify({"id": bot.id, "type": "tick", **payload})
            elif kind == "connected":
                await self._system(bot.id, "connected", source=instrument.source)
                # Os minutos que faltaram enquanto a ligação esteve em baixo
                since = (bot.last_closed or 0) + MINUTE_MS
                until = _now_ms() // MINUTE_MS * MINUTE_MS
                if since < until:
                    missing = await loop.run_in_executor(self.pool, fetch_minutes, instrument, since, until)
                    if missing:
                        bot.add_closed(missing)
                        await self._system(bot.id, "backfilled", minutes=len(missing))
                        await self._rerun(bot)
            elif kind == "disconnected":
                await self._system(bot.id, "disconnected", reason=value)
            elif bot.close_if_quiet(_now_ms(), QUIET_GRACE_MS):
                await self._rerun(bot)

            if bot.end_ms and _now_ms() >= bot.end_ms:
                await self._finish(bot, "finished")
                return
            if time.monotonic() - last_status_check >= 5:
                last_status_check = time.monotonic()
                if await self._status_of(bot.id) == "stopping":
                    await self._finish(bot, "stopped")
                    return
            if bot.funding is not None and time.monotonic() - last_funding >= FUNDING_REFRESH_SECONDS:
                last_funding = time.monotonic()
                bot.funding = await loop.run_in_executor(
                    self.pool, self._funding, instrument, _ms_from_funding(bot.funding), _now_ms()
                )

    async def _rerun(self, bot: LiveBot, final: bool = False) -> None:
        started = time.monotonic()
        events = await self._run_engine(bot, _now_ms(), final)
        await self._log(bot.id, events)
        await self._save_state(bot)
        took = time.monotonic() - started
        if took > 10:
            log.warning("O teste ao vivo %s levou %.1fs a correr o motor", bot.id, took)

    async def _finish(self, bot: LiveBot, status: str) -> None:
        """O fim (ou parado): as posições abertas fecham como no fim de uma simulação."""
        if not bot.end_ms or _now_ms() < bot.end_ms:
            bot.end_ms = _now_ms()
        await self._rerun(bot, final=True)
        await self._system(bot.id, status)
        await self._set_status(bot.id, status)

    # --- velas e funding (nas threads) -------------------------------------------
    def _history(self, instrument: Instrument, start_ms: int, end_ms: int) -> Candles:
        """Os minutos do aquecimento até agora: os que o ClickHouse já tem (das
        simulações) e o resto da corretora, em arrays."""
        stored = None
        try:
            client = clickhouse.connect(self.config)
            stored = load_minutes(client, instrument.id, _aware(start_ms), _aware(end_ms))
        except Exception as error:  # noqa: BLE001 — sem ClickHouse vai tudo à corretora
            log.warning("Sem as velas do ClickHouse (%s); vão todas da corretora", error)
        # Do ClickHouse só se aproveita o que está seguido desde o início
        if stored is not None and (not len(stored) or int(stored.time[0]) > start_ms + MINUTE_MS * 60):
            stored = None
        since = int(stored.time[-1]) + MINUTE_MS if stored is not None else start_ms
        fetched: list[Minute] = fetch_minutes(instrument, since, end_ms) if since < end_ms else []
        columns = []
        for name, dtype in (("time", np.int64), ("open", np.float64), ("high", np.float64), ("low", np.float64),
                            ("close", np.float64), ("volume", np.float64)):
            more = np.asarray([getattr(minute, name) for minute in fetched], dtype)
            columns.append(np.concatenate([getattr(stored, name), more]) if stored is not None else more)
        return Candles(*columns)

    def _wants_funding(self, bot: LiveBot, instrument: Instrument) -> bool:
        funding = bot.strategy.get("funding") or {}
        return instrument.type == "perpetual" and funding.get("mode") == "historical"

    def _funding(self, instrument: Instrument, start_ms: int, end_ms: int):
        times, rates = [], []
        try:
            client = clickhouse.connect(self.config)
            stored_times, stored_rates = load_funding(client, instrument.id, _aware(start_ms), _aware(end_ms))
            times, rates = list(stored_times), list(stored_rates)
        except Exception:  # noqa: BLE001
            pass
        since = int(times[-1]) + 1 if times else start_ms
        more_times, more_rates = fetch_funding(instrument, since, end_ms)
        return np.asarray(times + more_times, np.int64), np.asarray(rates + more_rates, np.float64)


def _aware(ms: int) -> datetime:
    return datetime.fromtimestamp(ms / 1000, tz=timezone.utc)


def _ms_from_funding(funding) -> int:
    times, _ = funding
    return int(times[0]) if len(times) else 0


async def _listen(config, service: Service) -> None:
    """Acorda o ciclo a cada aviso do backend (teste criado ou mandado parar)."""
    while not service.stopping:
        try:
            listener = await psycopg.AsyncConnection.connect(config.postgres_conninfo, autocommit=True)
            async with listener:
                await listener.execute("LISTEN live_test")
                async for _ in listener.notifies():
                    service.wake.set()
        except psycopg.OperationalError as error:
            log.warning("Ligação de escuta ao Postgres perdida (%s)", str(error).splitlines()[0])
            await asyncio.sleep(5)


async def _main() -> None:
    config = load_config()
    service = Service(config)
    await service.connect()
    listener = asyncio.create_task(_listen(config, service))
    log.info("Testes ao vivo prontos")
    try:
        while not service.stopping:
            try:
                # Com o Postgres em baixo, o `_execute` espera que ele volte
                await service.sync()
            except psycopg.Error as error:
                log.warning("Não foi possível ver os testes (%s)", str(error).splitlines()[0] if str(error) else error)
                await asyncio.sleep(5)
            try:
                await asyncio.wait_for(service.wake.wait(), timeout=POLL_SECONDS)
            except TimeoutError:
                pass
            service.wake.clear()
    finally:
        listener.cancel()
        for task in service.tasks.values():
            task.cancel()
        service.pool.shutdown(wait=False, cancel_futures=True)
        _stop_engine_pool(service.engine_pool)


def _stop_engine_pool(pool: ProcessPoolExecutor) -> None:
    """Para já os processos do motor (ao sair, sem esperar pela corrida em curso)."""
    terminate = getattr(pool, "terminate_workers", None)  # Python 3.14
    if terminate is not None:
        terminate()
    else:
        for process in list((getattr(pool, "_processes", None) or {}).values()):
            if process.is_alive():
                process.terminate()
    pool.shutdown(wait=False, cancel_futures=True)


def _terminate(*_):
    # O SIGTERM (o principal a parar) sai pelo `finally` do `_main`, que para os processos do motor
    raise KeyboardInterrupt


def main() -> None:
    """O processo dos testes ao vivo (o simulador arranca-o ao lado da fila)."""
    setup_logging()
    signal.signal(signal.SIGINT, signal.SIG_IGN)
    signal.signal(signal.SIGTERM, _terminate)
    try:
        # O psycopg assíncrono não funciona com o ciclo por omissão do Windows (Proactor)
        factory = asyncio.SelectorEventLoop if sys.platform == "win32" else None
        asyncio.run(_main(), loop_factory=factory)
    except KeyboardInterrupt:
        pass

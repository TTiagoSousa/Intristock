"""O que os trabalhadores do downloader partilham: o aviso de parar e os limites
de pedidos de cada corretora (vários pedidos correm ao mesmo tempo, um por
thread, mas a corretora vê um só IP).

Todas as esperas passam por aqui (`sleep`), para um SIGTERM as interromper logo:
o pedido a meio volta à fila e o mês a meio fica por descarregar.
"""

import threading
import time

# Mandaram parar (SIGTERM / Ctrl+C)
stopping = threading.Event()


class Stopped(Exception):
    """O downloader está a parar: o pedido em curso volta à fila."""


def check() -> None:
    if stopping.is_set():
        raise Stopped()


def sleep(seconds: float) -> None:
    """Espera, a não ser que mandem parar entretanto."""
    if seconds > 0 and stopping.wait(seconds):
        raise Stopped()
    check()


class RateLimiter:
    """Um intervalo mínimo entre pedidos e uma pausa comum, partilhados pelas
    threads que vão à mesma corretora (o limite é do IP, não de cada pedido)."""

    def __init__(self, min_interval: float = 0.0):
        self.min_interval = min_interval
        self._lock = threading.Lock()
        self._next_at = 0.0
        self._paused_until = 0.0

    def acquire(self) -> None:
        """Espera pela vez deste pedido."""
        with self._lock:
            now = time.monotonic()
            at = max(now, self._next_at, self._paused_until)
            self._next_at = at + self.min_interval
        sleep(at - now)

    def pause(self, seconds: float) -> None:
        """Ninguém pede durante `seconds` (a corretora pediu para esperar)."""
        with self._lock:
            self._paused_until = max(self._paused_until, time.monotonic() + seconds)

    def wait_pause(self) -> None:
        """Espera que acabe a pausa comum (sem gastar a vez de ninguém)."""
        with self._lock:
            wait = self._paused_until - time.monotonic()
        sleep(wait)

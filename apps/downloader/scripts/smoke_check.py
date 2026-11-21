"""Verificação rápida do downloader, sem rede nem bases de dados (para o CI).

1. Importa todos os módulos do pacote (`intristock_downloader`).
2. Os meses de um intervalo (`months_between`).
3. A Binance repete numa ligação cortada, num timeout e num 5xx, e desiste ao
   fim de `RETRIES` (com uma sessão a fingir, sem rede).
4. O limite partilhado (`RateLimiter`) e o parar (`control.Stopped`).

Uso (em apps/downloader): `python scripts/smoke_check.py`. Sai com 0 se estiver tudo bem.
"""

from __future__ import annotations

import importlib
import pkgutil
import sys
import threading
import time
from datetime import datetime, timezone
from pathlib import Path

ROOT = Path(__file__).resolve().parents[1]
sys.path.insert(0, str(ROOT))


def import_all() -> int:
    package = importlib.import_module("intristock_downloader")
    count = 1
    for module in pkgutil.walk_packages(package.__path__, "intristock_downloader."):
        importlib.import_module(module.name)
        count += 1
    return count


def check_months() -> None:
    from intristock_downloader.months import months_between

    utc = timezone.utc
    months = months_between(datetime(2024, 11, 15, tzinfo=utc), datetime(2025, 2, 1, tzinfo=utc))
    assert [m.strftime("%Y-%m") for m in months] == ["2024-11", "2024-12", "2025-01"], months


class _Response:
    def __init__(self, status: int, body=None, headers=None):
        self.status_code = status
        self._body = body
        self.headers = headers or {}

    def raise_for_status(self) -> None:
        if self.status_code >= 400:
            import requests

            raise requests.HTTPError(f"HTTP {self.status_code}")

    def json(self):
        return self._body


class _Session:
    """Responde pela ordem da lista (uma exceção é atirada)."""

    def __init__(self, answers: list):
        self.answers = list(answers)
        self.calls = 0

    def get(self, *_args, **_kwargs):
        self.calls += 1
        answer = self.answers.pop(0)
        if isinstance(answer, Exception):
            raise answer
        return answer


def check_binance_retries() -> None:
    import requests

    from intristock_downloader import binance, control

    real_sleep, real_session = control.sleep, binance._session
    control.sleep = lambda _seconds: control.check()
    try:
        kline = [1_700_000_000_000, "1", "2", "0.5", "1.5", "10", 0, "15", 3]
        session = _Session([
            requests.ConnectionError("cortada"),
            requests.Timeout("lenta"),
            _Response(503),
            _Response(200, [kline], {"X-MBX-USED-WEIGHT-1M": "10"}),
        ])
        binance._session = lambda: session
        rows = binance.fetch_candles(
            "00000000-0000-0000-0000-000000000001", "spot", "BTCUSDT", kline[0], kline[0] + 60_000
        )
        assert len(rows) == 1 and rows[0][2] == 1.0 and session.calls == 4, (rows, session.calls)

        session = _Session([requests.ConnectionError("cortada")] * binance.RETRIES)
        binance._session = lambda: session
        try:
            binance._get(binance.ENDPOINTS["spot"][0], 6000, {})
        except RuntimeError:
            pass
        else:
            raise AssertionError("a Binance devia desistir ao fim de RETRIES tentativas")
        assert session.calls == binance.RETRIES, session.calls
    finally:
        control.sleep, binance._session = real_sleep, real_session


def check_limiter_and_stop() -> None:
    from intristock_downloader import control

    limiter = control.RateLimiter(0.05)
    stamps = []

    def take():
        for _ in range(3):
            limiter.acquire()
            stamps.append(time.monotonic())

    threads = [threading.Thread(target=take) for _ in range(2)]
    for thread in threads:
        thread.start()
    for thread in threads:
        thread.join()
    stamps.sort()
    gaps = [b - a for a, b in zip(stamps, stamps[1:])]
    assert min(gaps) >= 0.04, gaps

    control.stopping.set()
    try:
        started = time.monotonic()
        try:
            control.sleep(30)
        except control.Stopped:
            pass
        else:
            raise AssertionError("o sleep devia parar com o aviso de parar")
        assert time.monotonic() - started < 1
    finally:
        control.stopping.clear()


def main() -> int:
    started = time.monotonic()
    print(f"imports: {import_all()} módulos")
    check_months()
    print("meses: ok")
    check_binance_retries()
    print("binance (repetir em erros de rede e 5xx): ok")
    check_limiter_and_stop()
    print("limite partilhado e parar: ok")
    print(f"ok ({time.monotonic() - started:.1f}s)")
    return 0


if __name__ == "__main__":
    sys.exit(main())

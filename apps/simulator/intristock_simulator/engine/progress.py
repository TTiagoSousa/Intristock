"""A barra de progresso da simulação e do relatório."""

import time

from .. import robustness
from .constants import EXECUTION_PRICES


# A barra de progresso: o ciclo principal fica com esta parte, o relatório (as
# variantes `lite`) com o resto. Cada variante que acaba avança uma, contra uma
# estimativa de quantas há (`_variants_expected`)
MAIN_SHARE = 0.4


class ReportProgress:
    """Onde vai o relatório, para a barra: a secção e as variantes feitas. A
    hora do fim prevê-se pelo tempo médio de cada variante (antes da primeira,
    pelo do ciclo principal, que custa o mesmo que uma)."""

    def __init__(self, on_progress, expected: int, main_seconds: float, base: dict):
        self.on_progress = on_progress
        self.expected = expected
        self.main_seconds = main_seconds
        self.base = base
        self.started = time.monotonic()
        self.section_name = "report"
        self.done = 0

    def section(self, name: str) -> None:
        self.section_name = name
        self.emit()

    def variant(self) -> None:
        self.done += 1
        self.emit()

    def emit(self) -> None:
        each = (time.monotonic() - self.started) / self.done if self.done else self.main_seconds
        remaining = max(self.expected - self.done, 0) * each
        fraction = min(self.done / self.expected, 0.99)
        self.on_progress(MAIN_SHARE + fraction * (1 - MAIN_SHARE), {
            **self.base,
            "phase": "report",
            "section": self.section_name,
            "variantsDone": self.done,
            "variantsTotal": max(self.expected, self.done),
            "estimatedEndAt": int((time.time() + remaining) * 1000),
        })


# O relatório em curso (um processo corre uma simulação de cada vez): as
# variantes `lite` contam-se nele
current: ReportProgress | None = None


def _section(name: str) -> None:
    if current is not None:
        current.section(name)


def _variants_expected(strategy: dict, entries: list[dict]) -> int:
    """Quantas variantes `lite` o relatório deve correr (uma estimativa, para a
    barra de progresso): as da 2.3, da 4.1 e 4.6, das regras da entrada, da 5.8 e
    5.9 e da robustez."""
    from .report.rules import rule_variants_expected
    versioned = strategy.get("version", 1) >= 3
    levels = sum(1 for entry in entries if (entry.get("price") or {"kind": "market"})["kind"] != "market")
    params = len(robustness.parameters(strategy)) if versioned else 0
    return max(1, (
        4 * levels + len(EXECUTION_PRICES) - 1
        + (len(entries) if versioned and len(entries) > 1 else 0) + 6
        + 13
        + params * len(robustness.SENS_STEPS) + (len(robustness.GRID_STEPS) ** 2 - 1 if params >= 2 else 0)
        + len(robustness.COST_VARIANTS)
        + rule_variants_expected(strategy)
    ))

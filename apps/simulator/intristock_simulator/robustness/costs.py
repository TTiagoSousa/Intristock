"""3.5 — Custos mais altos."""

from __future__ import annotations

import copy

from .. import factsheet as fs
from .common import _round


COST_VARIANTS = [
    # (chave, × comissão, + slippage em p.p.)
    ("fee2", 2.0, 0.0),
    ("fee3", 3.0, 0.0),
    ("slip05", 1.0, 0.05),
    ("slip10", 1.0, 0.1),
    ("fee2slip05", 2.0, 0.05),
]


# 3.5 — Custos


def cost_variant(strategy: dict, fee_mult: float, slip_add: float) -> dict:
    """A estratégia com a comissão × `fee_mult` (dos dois lados) e o slippage + `slip_add` p.p."""
    variant = copy.deepcopy(strategy)
    fee_entry = float(strategy.get("feeEntryPct", strategy.get("feePct") or 0))
    fee_exit = float(strategy.get("feeExitPct", strategy.get("feePct") or 0))
    variant["feeEntryPct"] = fee_entry * fee_mult
    variant["feeExitPct"] = fee_exit * fee_mult
    variant["slippagePct"] = float(strategy.get("slippagePct") or 0) + slip_add
    return variant


def cost_stress(strategy: dict, current: dict, rows: list[dict]) -> dict:
    """3.5 — As variantes dos custos e a comissão em que o retorno chega a 0
    (× a atual, interpolada entre ×1, ×2 e ×3; nula se não chega lá)."""
    fee_entry = float(strategy.get("feeEntryPct", strategy.get("feePct") or 0))
    fee_exit = float(strategy.get("feeExitPct", strategy.get("feePct") or 0))
    by_key = {row["variant"]: row for row in rows}
    curve = [(1.0, current["returnPct"])] + [(m, by_key[k]["returnPct"]) for k, m in (("fee2", 2.0), ("fee3", 3.0)) if k in by_key]
    breakeven = None
    if current["returnPct"] <= 0:
        breakeven = 1.0
    else:
        for (m1, r1), (m2, r2) in zip(curve, curve[1:]):
            if r1 > 0 >= r2:
                breakeven = m1 + (m2 - m1) * r1 / (r1 - r2)
                break
    return {
        "version": fs.VERSION,
        "feeEntryPct": fee_entry, "feeExitPct": fee_exit, "slippagePct": float(strategy.get("slippagePct") or 0),
        "current": current, "rows": rows, "breakEvenFeeMult": _round(breakeven, 2),
    }

"""Constantes e contas pequenas que todo o relatório usa."""

from __future__ import annotations

import numpy as np


DAY_MS = 24 * 60 * 60 * 1000

# Abaixo destes trades, uma hora, um dia ou uma célula é amostra pequena: o ecrã esbate-a
SAMPLE_MIN_TRADES = 5
YEAR_DAYS = 365.25
MONTH_DAYS = YEAR_DAYS / 12
# Cripto não fecha: os retornos diários anualizam-se com 365 dias
SHARPE_YEAR_DAYS = 365

# Os motivos de saída que contam como stop, como nas regras gerais do motor (o trailing e o
# break-even são stops que andaram; a liquidação, um stop forçado)
STOP_REASONS = {"stop_loss", "trailing_stop", "break_even", "liquidation"}


def _round(value, digits: int = 4):
    if value is None:
        return None
    return round(float(value), digits) + 0.0


def _costs(trades) -> dict:
    fees = sum(t.fees for t in trades)
    slippage = sum(t.slippage for t in trades)
    funding = sum(t.funding for t in trades)
    return {"fees": fees, "slippage": slippage, "funding": funding, "costs": fees + slippage + funding}


def _profit_factor(trades) -> float | None:
    gross_win = sum(t.pnl for t in trades if t.pnl > 0)
    gross_loss = -sum(t.pnl for t in trades if t.pnl <= 0)
    return gross_win / gross_loss if gross_loss > 0 else None


# --- 4. Entradas e saídas ----------------------------------------------------

# As saídas que contam como stop nos cartões da 4.3 (o trailing e o break-even têm linha própria)
STOP_EXIT = "stop_loss"


def _initial_stop(trade) -> bool:
    """Saiu no stop da entrada (não num que um ajuste, `stopRules`, mexeu: esses têm o
    número do ajuste em `exit_rule` e coluna própria na 4.2)."""
    return trade.exit_reason == STOP_EXIT and not trade.exit_rule


def _mean(values) -> float | None:
    values = [v for v in values if v is not None]
    return float(np.mean(values)) if values else None


def _payoff(trades) -> float | None:
    wins = [t.pnl for t in trades if t.pnl > 0]
    losses = [-t.pnl for t in trades if t.pnl <= 0]
    if not wins or not losses or np.mean(losses) <= 0:
        return None
    return float(np.mean(wins) / np.mean(losses))


def _win_rate(trades) -> float | None:
    return sum(1 for t in trades if t.pnl > 0) / len(trades) * 100 if trades else None

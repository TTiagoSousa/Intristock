"""Junta os blocos do relatório que só dependem dos trades e da equity."""

from __future__ import annotations

from .equity import _daily_equity, _performance_index
from .samples import sample_equity, sample_split
from .summary.curves import equity_curve, equity_in_base, underwater
from .summary.metrics import strategy_score, summary
from .summary.returns import daily_distribution, horizon_returns, monthly_detail, period_returns, rolling_sharpe
from .summary.risk import capture_ratios, drawdown_episodes, returns_scatter, risk_metrics, risk_ratios


def build(
    trades, initial, final, deposits, deposit_amounts, minutes, start_ms, end_ms, max_positions, fee_entry,
    out_of_sample_pct,
    entries=(),
) -> dict:
    """Todos os blocos do relatório, pelos nomes das colunas."""
    marks, prices, values, invested_at = _daily_equity(
        trades, initial, deposits, deposit_amounts, minutes, start_ms, end_ms
    )
    index = _performance_index(values, invested_at)
    numbers = summary(
        trades, initial, final, deposits, deposit_amounts, minutes, start_ms, end_ms, max_positions, fee_entry, index
    )
    periods = period_returns(marks, index, start_ms, end_ms)
    return {
        "summaryMetrics": numbers,
        "strategyScore": strategy_score(trades, numbers, index, marks, out_of_sample_pct),
        "equityCurve": equity_curve(
            marks, prices, values, index, final, initial, deposits, deposit_amounts, minutes, fee_entry
        ),
        "equityInBase": equity_in_base(marks, prices, values, final, minutes),
        "underwater": underwater(marks, index),
        "periodReturns": periods,
        "horizonReturns": horizon_returns(trades, marks, prices, index, minutes, start_ms, end_ms, fee_entry),
        "dailyDistribution": daily_distribution(index),
        "rollingSharpe": rolling_sharpe(marks, index),
        "monthlyDetail": monthly_detail(trades, marks, values, index, start_ms, end_ms),
        "riskMetrics": risk_metrics(index),
        "drawdownEpisodes": drawdown_episodes(marks, index),
        "riskRatios": risk_ratios(trades, numbers, index, prices, minutes, periods["months"], start_ms, end_ms),
        "captureRatios": capture_ratios(index, prices, minutes),
        "returnsScatter": returns_scatter(marks, index, prices, minutes),
        "sampleSplit": sample_split(
            trades, index, marks, prices, float(minutes.close[-1]), list(entries), out_of_sample_pct
        ),
        "sampleEquity": sample_equity(marks, values, out_of_sample_pct),
    }

"""O resumo de uma corrida (`result`) e as partes dentro e fora da amostra."""

import numpy as np

from ..market.candles import Bars, Candles
from .models import Trade


def _exit_order(key: str):
    if key.startswith("signal:"):
        return (2, int(key.split(":")[1]))
    order = {
        "stop_loss": 0,
        "trailing_stop": 0.1,
        "break_even": 0.2,
        "take_profit": 1,
        "time": 2.5,
        "liquidation": 3,
        "opposite": 4,
        "excluded": 5,
        "end": 6,
    }
    return (order.get(key, 7), 0)


def _drawdown(trades: list[Trade]) -> float:
    """Drawdown sobre o retorno acumulado dos trades (sem depósitos é o mesmo
    que sobre o capital no fim de cada trade)."""
    growth, peak, max_drawdown = 1.0, 1.0, 0.0
    for trade in trades:
        growth *= 1 + trade.capital_return
        peak = max(peak, growth)
        if peak > 0:
            max_drawdown = max(max_drawdown, (peak - growth) / peak * 100)
    return max_drawdown


def summarize(
    trades: list[Trade],
    initial: float,
    final: float,
    bars: Bars,
    first_bar: int,
    entries: list[dict],
    deposited: float = 0.0,
) -> dict:
    """O resumo; `trades` pela ordem em que saíram."""
    wins = [trade for trade in trades if trade.pnl > 0]
    losses = [trade for trade in trades if trade.pnl <= 0]
    gross_win = sum(trade.pnl for trade in wins)
    gross_loss = -sum(trade.pnl for trade in losses)

    reasons = {"stop_loss": 0, "take_profit": 0, "signal": 0, "end": 0}
    for trade in trades:
        reasons[trade.exit_reason] = reasons.get(trade.exit_reason, 0) + 1

    # Como correu cada entrada da estratégia
    by_entry = []
    for index, entry in enumerate(entries, start=1):
        own = [trade for trade in trades if trade.entry_rule == index]
        by_entry.append(
            {
                "rule": index,
                "side": entry["side"],
                "trades": len(own),
                "wins": sum(1 for trade in own if trade.pnl > 0),
                "pnl": float(sum(trade.pnl for trade in own)),
            }
        )

    # Cada par entrada → saída ("entrou pela 1, saiu pelo stop"). A saída é
    # stop_loss, take_profit, signal:N (a saída N da entrada), liquidation,
    # opposite, excluded ou end
    groups: dict[tuple[int, str], list[Trade]] = {}
    for trade in trades:
        key = f"signal:{trade.exit_rule}" if trade.exit_reason == "signal" else trade.exit_reason
        groups.setdefault((trade.entry_rule, key), []).append(trade)
    by_exit = [
        {
            "rule": rule,
            "exit": key,
            "trades": len(own),
            "wins": sum(1 for trade in own if trade.pnl > 0),
            "pnl": float(sum(trade.pnl for trade in own)),
        }
        for (rule, key), own in sorted(groups.items(), key=lambda item: (item[0][0], _exit_order(item[0][1])))
    ]

    first_open = float(bars.open[first_bar])
    last_close = float(bars.close[-1])
    invested = initial + deposited

    return {
        "initialCapital": initial,
        "finalCapital": final,
        "totalDeposits": deposited,
        "netProfit": final - invested,
        "netProfitPct": (final - invested) / invested * 100,
        "trades": len(trades),
        "wins": len(wins),
        "losses": len(losses),
        "winRate": len(wins) / len(trades) * 100 if trades else None,
        "profitFactor": gross_win / gross_loss if gross_loss > 0 else None,
        "maxDrawdownPct": _drawdown(trades),
        "avgTradePct": sum(trade.pnl_pct for trade in trades) / len(trades) if trades else None,
        "bestTradePct": max((trade.pnl_pct for trade in trades), default=None),
        "worstTradePct": min((trade.pnl_pct for trade in trades), default=None),
        "totalFees": sum(trade.fees for trade in trades),
        "totalSlippage": sum(trade.slippage for trade in trades),
        "exitReasons": reasons,
        "longs": sum(1 for trade in trades if trade.side == "long"),
        "shorts": sum(1 for trade in trades if trade.side == "short"),
        "byEntry": by_entry,
        "byExit": by_exit,
        # O que dava comprar no início e vender no fim, para comparar
        "buyHoldPct": (last_close - first_open) / first_open * 100,
        "bars": len(bars) - first_bar,
        "firstBarTime": int(bars.time[first_bar]),
        "lastBarTime": int(bars.time[-1]),
    }


def _in_base(initial, final, deposits, deposit_amounts, bars: Bars, first_bar: int, minutes: Candles) -> dict:
    """O resultado na moeda do ativo (BTC num BTC/USDT): o capital no início
    comprado ao primeiro preço, cada depósito ao preço do dia e o final ao
    último. Mostra se a estratégia deu mais moedas do que só as guardar."""
    first_open = float(bars.open[first_bar])
    last_close = float(bars.close[-1])
    prices = minutes.open[np.clip(np.searchsorted(minutes.time, deposits, side="left"), 0, len(minutes) - 1)]
    start = initial / first_open
    added = float(np.sum(deposit_amounts / prices)) if len(deposits) else 0.0
    end = final / last_close
    return {
        "initial": start,
        "deposits": added,
        "final": end,
        "netProfitPct": (end - start - added) / (start + added) * 100,
    }


def _samples(trades, initial, deposits, deposit_amounts, bars: Bars, first_bar: int, end_ms: int, split_pct: float):
    """Dentro e fora da amostra: os trades que entram antes e depois de
    `split_pct` % do período, cada parte com o seu resumo."""
    start_ms = int(bars.time[first_bar])
    split = start_ms + int((end_ms - start_ms) * split_pct / 100)
    split_bar = int(np.searchsorted(bars.time, split, side="left"))
    before = [trade for trade in trades if trade.entry_time < split]
    after = [trade for trade in trades if trade.entry_time >= split]
    # O capital na divisão: o inicial, os trades fechados e os depósitos até lá
    at_split = (
        initial
        + sum(trade.pnl for trade in trades if trade.exit_time < split)
        + float(deposit_amounts[: int(np.searchsorted(deposits, split, side="right"))].sum())
    )

    def part(own: list[Trade], capital: float, first: int, last: int) -> dict:
        wins = [trade for trade in own if trade.pnl > 0]
        gross_win = sum(trade.pnl for trade in wins)
        gross_loss = -sum(trade.pnl for trade in own if trade.pnl <= 0)
        pnl = sum(trade.pnl for trade in own)
        first_open = float(bars.open[min(first, len(bars) - 1)])
        last_close = float(bars.close[max(min(last, len(bars) - 1), 0)])
        return {
            "trades": len(own),
            "wins": len(wins),
            "winRate": len(wins) / len(own) * 100 if own else None,
            "netProfit": pnl,
            "netProfitPct": pnl / capital * 100 if capital > 0 else None,
            "profitFactor": gross_win / gross_loss if gross_loss > 0 else None,
            "maxDrawdownPct": _drawdown(own),
            "buyHoldPct": (last_close - first_open) / first_open * 100,
        }

    return {
        "splitPct": split_pct,
        "splitTime": split,
        "inSample": part(before, initial, first_bar, split_bar - 1),
        "outOfSample": part(after, at_split, split_bar, len(bars) - 1),
    }

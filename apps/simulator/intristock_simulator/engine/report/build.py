"""O relatório completo de uma simulação (não `lite`): um bloco por coluna."""

from ... import factsheet
from ... import robustness
from ..clock import _hour_band
from ..models import Trade
from ..progress import _section
from ..summary import _samples
from .entries import _entries_report
from .orders import _execution_variants, _order_variants
from .robustness import _robustness_report
from .rules import _rules_report, chart_levels
from .schedule import _schedule_report


def _report(bars, first_bar, minutes, strategy, start_ms, end_ms, timeframe, funding, trades, summary, initial,
            capital, deposits, deposit_amounts, most_open, fee_entry, entries, order_stats, funnel, signals_by_rule,
            clock, funding_times, funding_rates, funding_minutes, rule_stats, chart) -> tuple[list[Trade], dict, dict]:
    """O relatório da simulação (não `lite`): um bloco por coluna."""
    split = float(strategy.get("outOfSamplePct") or 0)
    if 0 < split < 100:
        summary["samples"] = _samples(trades, initial, deposits, deposit_amounts, bars, first_bar, end_ms, split)

    report = factsheet.build(
        trades, initial, capital, deposits, deposit_amounts, minutes, start_ms, end_ms, most_open, fee_entry, split,
        entries,
    )
    # A 2.1 precisa das velas no tempo gráfico, que só o motor tem
    report["dataQuality"] = factsheet.data_quality(bars, minutes, first_bar, start_ms, end_ms, timeframe)
    report["signalFunnel"] = factsheet.signal_funnel(funnel, len(bars) - first_bar, trades)
    report["entryBreakdown"] = factsheet.entry_breakdown(entries, signals_by_rule, trades)
    # 2.3 as ordens: o que as de nível custam e rendem, por tipo, e as variantes
    report["orderExecution"] = factsheet.order_execution(entries, order_stats, trades)
    report["orderTypes"] = factsheet.order_types(trades)
    _section("orders")
    report["orderVariants"] = _order_variants(
        bars, minutes, strategy, start_ms, timeframe, funding, entries, trades, summary, order_stats
    )
    report["executionVariants"] = _execution_variants(
        bars, minutes, strategy, start_ms, timeframe, funding, summary, report["summaryMetrics"]["maxDrawdownPct"]
    )
    # 4. Entradas e saídas (com a estratégia corrida sem cada entrada e com os esquemas de risco)
    _section("entries")
    paths = factsheet.trade_paths(trades, entries, bars, minutes)
    # O diário de trades (4.7) grava-as com cada trade
    for path in paths:
        path["trade"].mae_pct = path["maePct"]
        path["trade"].mfe_pct = path["mfePct"]
        path["trade"].bars = path["bars"]
        path["trade"].r = path["r"]
    report.update(_entries_report(
        bars, minutes, strategy, start_ms, end_ms, timeframe, funding, entries, trades, summary, initial,
        deposits, deposit_amounts, split, paths,
    ))
    # 2.2 e 4.9 as regras da entrada, com a estratégia corrida sem cada uma; e os níveis para o gráfico
    _section("rules")
    report.update(_rules_report(
        bars, minutes, strategy, start_ms, timeframe, funding, entries, trades, summary, paths, rule_stats,
        signals_by_rule,
    ))
    report["chartLevels"] = chart_levels(chart, first_bar, strategy)
    # 4.10 o perfil de volume (só com uma estratégia que o use)
    report.update(factsheet.profile_report(paths, bars, strategy, timeframe))
    # 5. Horários: na hora local da simulação (com a mudança de hora)
    _section("hours")
    zone = clock.zone.key if hasattr(clock.zone, "key") else "UTC"
    report.update(factsheet.hours_report(trades, entries, clock.local, zone))
    report.update(factsheet.exit_hours_report(trades, entries, clock.local, zone))
    report.update(factsheet.weekdays_report(trades, entries, clock.local, zone, start_ms, end_ms))
    report.update(factsheet.weekday_hours_report(trades, clock.local, zone))
    report.update(factsheet.calendar_report(
        trades, initial, deposits, deposit_amounts, minutes, clock.zone, zone, start_ms, end_ms
    ))
    report.update(factsheet.entry_hours_report(trades, entries, clock.local, zone, [_hour_band(e.get("schedule")) for e in entries]))
    report.update(factsheet.position_time_report(
        trades, clock.local, zone, start_ms, end_ms, minutes, funding_times, funding_rates, funding_minutes
    ))
    _section("schedule")
    report.update(_schedule_report(
        bars, minutes, strategy, start_ms, end_ms, timeframe, funding, entries, trades, summary,
        funnel["blockedSchedule"], initial, deposits, deposit_amounts, split, clock, zone,
    ))
    # 3.2 a 3.6 a robustez e, com tudo feito, o veredicto
    _section("robustness")
    report.update(_robustness_report(
        bars, minutes, strategy, start_ms, end_ms, timeframe, funding, trades, summary,
        initial, deposits, deposit_amounts, split,
    ))
    report["verdicts"] = robustness.verdicts(report, trades)
    # 3.8 o desafio de prop firm (só com as regras dele)
    report.update(robustness.prop_challenge(
        strategy.get("propFirm"), trades, initial, minutes, clock.local, start_ms, end_ms, bool(len(deposits)),
    ))

    # Gravam-se pela ordem de entrada
    trades.sort(key=lambda trade: (trade.entry_time, trade.entry_rule))
    return trades, summary, report

"""O relatório de uma simulação: o que se mostra no Resumo e o que uma IA lê
para avaliar a estratégia. Cada bloco é uma coluna JSONB da `SimulationRun`
(ver REPORT_COLUMNS), já com tudo calculado: o ecrã só mostra.

Tudo sai dos trades já fechados (o fim do período fecha os que ficaram
abertos) e das velas de 1 minuto: não mexe no motor.
"""

from __future__ import annotations

from .build import (
    build,
)
from .columns import (
    REPORT_COLUMNS,
    VERSION,
)
from .common import (
    DAY_MS,
    MONTH_DAYS,
    SAMPLE_MIN_TRADES,
    SHARPE_YEAR_DAYS,
    STOP_EXIT,
    STOP_REASONS,
    YEAR_DAYS,
    _profit_factor,
    _round,
)
from .entries.anatomy import (
    PATH_AFTER_SEPARATION,
    PATH_MAX_BARS,
    PATH_MIN_BARS,
    PATH_PERCENTILE,
    SEPARATION_MAX_BARS,
    SEPARATION_R,
    exit_efficiency,
    next_trade,
    trade_anatomy,
    trade_groups,
    trade_path,
)
from .entries.distribution import (
    DURATION_BUCKETS,
    MAE_RESULT_HEADROOM,
    MAE_RESULT_PERCENTILE,
    R_BIN,
    R_RANGE,
    duration_buckets,
    mae_scatter,
    r_distribution,
)
from .entries.paths import (
    EXIT_COLUMN_ORDER,
    _exit_columns,
    trade_paths,
)
from .entries.performance import (
    entry_cards,
    entry_equity,
    entry_exit_matrix,
    entry_performance,
    exit_mix,
)
from .entries.sizing import (
    SCHEME_MAX_RISK,
    SCHEME_RISK,
    SIZING_SCHEMES,
    SUGGESTION_MAX_RISK,
    entry_correlation,
    entry_kelly,
    scheme_risks,
    scheme_stats,
)
from .entries.stops import (
    AFTER_EXIT_BARS,
    AFTER_EXIT_KINDS,
    CONTINUED_PCT,
    REVERSAL_MS,
    after_exit,
    exit_reasons,
    stop_cards,
    stops_by_month,
)
from .equity import (
    _daily_equity,
    _max_drawdown,
    _performance_index,
    max_drawdown,
)
from .hours.calendar_days import (
    CALENDAR_FLAT,
    CALENDAR_LIST,
    calendar_report,
)
from .hours.day_hour_grid import (
    GRID_MIN_TRADES,
    GRID_PNL_PERCENTILE,
    weekday_hours_report,
)
from .hours.entry_hours import (
    HOUR_SESSIONS,
    hours_report,
)
from .hours.entry_profiles import (
    HOUR_BLOCK,
    entry_hours_report,
)
from .hours.exit_hours import (
    EXIT_HOUR_REASONS,
    NIGHT_HOURS,
    WIN_EXITS,
    exit_hours_report,
)
from .hours.filters import (
    FILTER_BEST_HOURS,
    FILTER_NIGHT_HOURS,
    FILTER_STOPS_PCT,
    FILTER_TABLE_HOURS,
    FILTER_WORST_HOURS,
    filter_candidates,
    variant_stats,
)
from .hours.gaps import (
    GAP_HOUR_MS,
    gaps_report,
)
from .hours.position_time import (
    DURATION_REASONS,
    FUNDING_HOURS,
    SESSION_MOMENTS,
    _instants,
    _local_times,
    position_time_report,
)
from .hours.weekdays import (
    WEEK_DAYS,
    weekdays_report,
)
from .hours.world_sessions import (
    SESSION_EDGES,
    WORK_HOURS,
    WORLD_SESSIONS,
    world_sessions_report,
)
from .samples import (
    DEFAULT_OUT_OF_SAMPLE_PCT,
    SAMPLE_METRICS,
    sample_equity,
    sample_split,
    split_time,
)
from .setup import (
    FUNNEL_KEYS,
    GAP_THRESHOLD_PCT,
    ORDER_KINDS,
    data_quality,
    entry_breakdown,
    order_execution,
    order_types,
    signal_funnel,
)
from .summary.curves import (
    equity_curve,
    equity_in_base,
    underwater,
)
from .summary.metrics import (
    SCORE_LABELS,
    SCORE_SCALES,
    SCORE_WEIGHTS,
    strategy_score,
    summary,
)
from .summary.returns import (
    DISTRIBUTION_BINS,
    DISTRIBUTION_MAX_SIGMAS,
    HORIZON_MONTHS,
    ROLLING_SHARPE_DAYS,
    daily_distribution,
    horizon_returns,
    monthly_detail,
    period_returns,
    rolling_sharpe,
)
from .summary.risk import (
    RATIO_LEVELS,
    SQN_MAX_TRADES,
    capture_ratios,
    drawdown_episodes,
    returns_scatter,
    risk_metrics,
    risk_ratios,
)
from .profile import (
    DISTANCE_EDGES,
    POSITION_KEYS,
    profile_report,
)
from .rules import (
    context_rules,
    scale_in_stats,
    setup_funnel,
    stop_rule_stats,
)

__all__ = [
    "DISTANCE_EDGES",
    "POSITION_KEYS",
    "profile_report",
    "AFTER_EXIT_BARS",
    "AFTER_EXIT_KINDS",
    "CALENDAR_FLAT",
    "CALENDAR_LIST",
    "CONTINUED_PCT",
    "DAY_MS",
    "DEFAULT_OUT_OF_SAMPLE_PCT",
    "DISTRIBUTION_BINS",
    "DISTRIBUTION_MAX_SIGMAS",
    "DURATION_BUCKETS",
    "DURATION_REASONS",
    "EXIT_COLUMN_ORDER",
    "EXIT_HOUR_REASONS",
    "FILTER_BEST_HOURS",
    "FILTER_NIGHT_HOURS",
    "FILTER_STOPS_PCT",
    "FILTER_TABLE_HOURS",
    "FILTER_WORST_HOURS",
    "FUNDING_HOURS",
    "FUNNEL_KEYS",
    "GAP_HOUR_MS",
    "GAP_THRESHOLD_PCT",
    "GRID_MIN_TRADES",
    "GRID_PNL_PERCENTILE",
    "HORIZON_MONTHS",
    "HOUR_BLOCK",
    "HOUR_SESSIONS",
    "MAE_RESULT_HEADROOM",
    "MAE_RESULT_PERCENTILE",
    "MONTH_DAYS",
    "NIGHT_HOURS",
    "ORDER_KINDS",
    "PATH_AFTER_SEPARATION",
    "PATH_MAX_BARS",
    "PATH_MIN_BARS",
    "PATH_PERCENTILE",
    "RATIO_LEVELS",
    "REPORT_COLUMNS",
    "REVERSAL_MS",
    "ROLLING_SHARPE_DAYS",
    "R_BIN",
    "R_RANGE",
    "SAMPLE_METRICS",
    "SAMPLE_MIN_TRADES",
    "SCHEME_MAX_RISK",
    "SCHEME_RISK",
    "SCORE_LABELS",
    "SCORE_SCALES",
    "SCORE_WEIGHTS",
    "SEPARATION_MAX_BARS",
    "SEPARATION_R",
    "SESSION_EDGES",
    "SESSION_MOMENTS",
    "SHARPE_YEAR_DAYS",
    "SIZING_SCHEMES",
    "SQN_MAX_TRADES",
    "STOP_EXIT",
    "STOP_REASONS",
    "SUGGESTION_MAX_RISK",
    "VERSION",
    "WEEK_DAYS",
    "WIN_EXITS",
    "WORK_HOURS",
    "WORLD_SESSIONS",
    "YEAR_DAYS",
    "_daily_equity",
    "_exit_columns",
    "_instants",
    "_local_times",
    "_max_drawdown",
    "_performance_index",
    "_profit_factor",
    "_round",
    "after_exit",
    "build",
    "calendar_report",
    "capture_ratios",
    "daily_distribution",
    "data_quality",
    "drawdown_episodes",
    "duration_buckets",
    "entry_breakdown",
    "entry_cards",
    "entry_correlation",
    "entry_equity",
    "entry_exit_matrix",
    "entry_hours_report",
    "entry_kelly",
    "entry_performance",
    "equity_curve",
    "equity_in_base",
    "exit_efficiency",
    "exit_hours_report",
    "exit_mix",
    "exit_reasons",
    "filter_candidates",
    "gaps_report",
    "horizon_returns",
    "hours_report",
    "mae_scatter",
    "max_drawdown",
    "monthly_detail",
    "next_trade",
    "order_execution",
    "order_types",
    "period_returns",
    "position_time_report",
    "r_distribution",
    "returns_scatter",
    "risk_metrics",
    "risk_ratios",
    "rolling_sharpe",
    "sample_equity",
    "sample_split",
    "scheme_risks",
    "scheme_stats",
    "signal_funnel",
    "split_time",
    "stop_cards",
    "stops_by_month",
    "strategy_score",
    "summary",
    "trade_anatomy",
    "trade_groups",
    "trade_path",
    "trade_paths",
    "underwater",
    "variant_stats",
    "weekday_hours_report",
    "weekdays_report",
    "world_sessions_report",
    "context_rules",
    "scale_in_stats",
    "setup_funnel",
    "stop_rule_stats",
]

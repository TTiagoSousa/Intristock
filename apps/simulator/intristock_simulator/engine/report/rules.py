"""2.2 e 4.9 — As regras da entrada (a estratégia corrida sem cada uma) e os
níveis que não são indicadores, para o gráfico."""

import copy

import numpy as np

from ... import factsheet
from ...strategy import Chart, operand_series
from ..simulate import run

# As listas de regras de uma entrada que se tiram uma a uma (a chave dos `variants`)
RULE_LISTS = ("context", "stopRules", "scaleIns")

# Os valores que o gráfico não sabe desenhar sozinho (a biblioteca só tem as médias e o RSI)
LEVEL_KINDS = ("highest", "lowest", "session")
# Os pontos de todas as séries juntas; com mais (tempos gráficos pequenos em anos), não vão
LEVEL_MAX_POINTS = 200_000


def rule_variants_expected(strategy: dict) -> int:
    """Quantas variantes as regras correm (para a barra de progresso)."""
    if strategy.get("version", 1) < 3:
        return 0
    return sum(len(entry.get(name) or []) for entry in strategy.get("entries") or [] for name in RULE_LISTS)


def _rule_variants(bars, minutes, strategy, start_ms, timeframe, funding) -> dict:
    """A estratégia corrida sem cada condição da conta, ajuste do stop e reforço:
    {lista: {(entrada, regra): (trades, retorno, max DD)}}."""
    found = {name: {} for name in RULE_LISTS}
    if strategy.get("version", 1) < 3:
        return found
    for index, entry in enumerate(strategy.get("entries") or []):
        for name in RULE_LISTS:
            for number in range(len(entry.get(name) or [])):
                variant = copy.deepcopy(strategy)
                del variant["entries"][index][name][number]
                own_trades, own_summary, extra = run(
                    bars, minutes, variant, start_ms, lambda _: None, timeframe, funding, lite=True
                )
                found[name][(index + 1, number + 1)] = (
                    len(own_trades), own_summary["netProfitPct"], -extra["maxDrawdownPct"],
                )
    return found


def _rules_report(bars, minutes, strategy, start_ms, timeframe, funding, entries, trades, summary, paths,
                  rule_stats, signals_by_rule) -> dict:
    """2.2 a preparação e as condições da conta; 4.9 os ajustes do stop e os reforços."""
    variants = _rule_variants(bars, minutes, strategy, start_ms, timeframe, funding)
    current = summary["netProfitPct"]
    return {
        "setupFunnel": factsheet.setup_funnel(entries, rule_stats["setup"], signals_by_rule, trades),
        "contextRules": factsheet.context_rules(
            entries, rule_stats["context"], signals_by_rule, variants["context"], current
        ),
        "stopRuleStats": factsheet.stop_rule_stats(paths, entries, variants["stopRules"], current),
        "scaleInStats": factsheet.scale_in_stats(paths, entries, rule_stats["adds"], variants["scaleIns"], current),
    }


def _operands(node, found: dict) -> None:
    """Os valores de `LEVEL_KINDS` que a estratégia usa, sem repetidos."""
    if isinstance(node, dict):
        if node.get("kind") in LEVEL_KINDS:
            keys = ("kind", "field", "period", "offset", "timeframe", "level", "rangeStart", "rangeMinutes")
            operand = {key: node[key] for key in keys if node.get(key) is not None}
            found.setdefault(repr(sorted(operand.items())), operand)
        for child in node.values():
            _operands(child, found)
    elif isinstance(node, list):
        for child in node:
            _operands(child, found)


def chart_levels(chart: Chart, first_bar: int, strategy: dict) -> dict:
    """Gráfico — os níveis que não são indicadores (a máxima/mínima de N velas e os
    do dia e da semana) como a estratégia os viu na abertura de cada vela: só os
    pontos em que mudam ([tempo, valor]; nulo sem valor), para se desenharem em
    degraus. Do aquecimento só a última vela, para a linha começar no início."""
    found: dict = {}
    _operands(strategy.get("entries") or [], found)
    series, points = [], 0
    start = max(first_bar - 1, 0)
    times = chart.bars.time[start:]
    for operand in found.values():
        values = operand_series(chart, operand)[start:]
        changed = np.r_[True, ~((values[1:] == values[:-1]) | (np.isnan(values[1:]) & np.isnan(values[:-1])))]
        at = np.flatnonzero(changed)
        points += len(at)
        if points > LEVEL_MAX_POINTS:
            return {"version": factsheet.VERSION, "available": False, "reason": "tooMany", "series": []}
        series.append({
            "operand": operand,
            "points": [[int(times[i]), None if np.isnan(values[i]) else round(float(values[i]), 8)] for i in at],
        })
    return {"version": factsheet.VERSION, "available": bool(series), "reason": None, "series": series}

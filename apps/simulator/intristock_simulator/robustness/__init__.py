"""A robustez de uma simulação (ecrã 3, Provas, a seguir à 3.1) e o veredicto.

Tudo calculado aqui, como no `factsheet`: um bloco por coluna JSONB da
`SimulationRun` (em `factsheet.REPORT_COLUMNS`). O motor corre as variantes (`lite`) e
passa os trades de cada uma; este módulo só faz as contas:

- 3.2 Monte Carlo: os retornos diários do índice de performance sorteados aos
  blocos (`MC_BLOCK_DAYS` dias seguidos, para as fases boas e más ficarem
  juntas), `MC_PATHS` caminhos com a semente fixa: o leque do capital, a
  distribuição da maior queda e a probabilidade de perder ou de cair X%.
- 3.3 Walk-forward: o período em `WF_WINDOWS` janelas; em cada uma, a
  estratégia como está e a variante de parâmetros que foi a melhor na janela
  anterior (escolhida sem ver o futuro).
- 3.4 Sensibilidade: cada parâmetro (períodos das médias, stop, take,
  trailing e break-even de cada entrada) × `SENS_STEPS`, e um mapa dos dois
  que mais mexem no resultado.
- 3.5 Custos: as comissões e o slippage mais altos.
- 3.6 Regimes: tendência (o preço contra a média de `REGIME_TREND_DAYS` dias
  e a inclinação dela) e volatilidade (acima ou abaixo da mediana), dia a dia
  e pelo dia de entrada de cada trade, sem olhar para o futuro (o regime do
  dia é o da véspera).
- 3.8 Desafio de prop firm: as regras de `strategy.propFirm` (perda diária,
  perda máxima, objetivo, dias) no capital minuto a minuto, no período todo e
  em janelas que começam a cada segunda-feira (`prop_firm.py`).
- O veredicto: cada teste passa, falha ou fica por decidir, e as conclusões
  de cada ecrã.
"""

from __future__ import annotations

from .common import (
    daily_index,
    performance_curve,
)
from .costs import (
    COST_VARIANTS,
    cost_stress,
    cost_variant,
)
from .monte_carlo import (
    MC_BINS,
    MC_BLOCK_DAYS,
    MC_PATHS,
    MC_POINTS,
    MC_RUIN_LEVELS,
    MC_SEED,
    monte_carlo,
)
from .prop_firm import (
    prop_challenge,
)
from .parameters import (
    ENTRY_PARAMS,
    GRID_STEPS,
    SENS_STEPS,
    _scaled,
    apply,
    parameters,
    sensitivity,
)
from .regimes import (
    REGIME_MIN_DAYS,
    REGIME_SLOPE_DAYS,
    REGIME_TREND_DAYS,
    REGIME_VOL_DAYS,
    regimes,
)
from .verdicts import (
    STOPS_REVERSED_PCT,
    VERDICT_GOOD_TRADES,
    VERDICT_MIN_TRADES,
    verdicts,
)
from .walk_forward import (
    WF_WINDOWS,
    walk_forward,
)

__all__ = [
    "COST_VARIANTS",
    "ENTRY_PARAMS",
    "GRID_STEPS",
    "MC_BINS",
    "MC_BLOCK_DAYS",
    "MC_PATHS",
    "MC_POINTS",
    "MC_RUIN_LEVELS",
    "MC_SEED",
    "REGIME_MIN_DAYS",
    "REGIME_SLOPE_DAYS",
    "REGIME_TREND_DAYS",
    "REGIME_VOL_DAYS",
    "SENS_STEPS",
    "STOPS_REVERSED_PCT",
    "VERDICT_GOOD_TRADES",
    "VERDICT_MIN_TRADES",
    "WF_WINDOWS",
    "_scaled",
    "apply",
    "cost_stress",
    "cost_variant",
    "daily_index",
    "monte_carlo",
    "parameters",
    "performance_curve",
    "prop_challenge",
    "regimes",
    "sensitivity",
    "verdicts",
    "walk_forward",
]

"""Trades, ordens e posições, e o erro de um período sem velas."""

from dataclasses import dataclass, field

import numpy as np


@dataclass
class Trade:
    entry_rule: int  # 1, 2… a entrada da estratégia que o abriu
    side: str
    entry_time: int
    entry_price: float
    exit_time: int
    exit_price: float
    # stop_loss | take_profit | signal | liquidation | opposite | excluded | end
    exit_reason: str
    exit_rule: int | None  # com signal: a saída da entrada (1, 2…)
    quantity: float
    pnl: float
    pnl_pct: float  # sobre a margem
    fees: float
    equity: float
    funding: float = 0.0
    # Não se gravam: o retorno sobre o capital todo (para o drawdown), o que o
    # slippage custou e a margem
    capital_return: float = 0.0
    slippage: float = 0.0
    margin: float = 0.0
    # 2.3: como entrou (market, limit ou stop), as velas desde o sinal e o
    # slippage que uma ordem limite não pagou
    order_kind: str = "market"
    wait_bars: int = 0
    slippage_saved: float = 0.0
    # 4.x: o preço de entrada antes do slippage (onde ficam o stop e o take)
    raw_entry: float = 0.0
    # 4.7 (gravam-se): a excursão adversa e a favorável em % do preço de entrada e
    # as velas abertas; preenchidas no relatório (nas variantes ficam nulas)
    mae_pct: float | None = None
    mfe_pct: float | None = None
    bars: int | None = None
    # 5.1 (não se grava): o resultado em R (sem stop, nulo)
    r: float | None = None
    # O stop e o take planeados ao entrar (não se gravam): o nível de cada um e a
    # distância ao stop em % do preço antes do slippage, que é o risco (1R)
    stop_level: float | None = None
    take_level: float | None = None
    stop_pct: float | None = None
    # As saídas parciais antes da final (grava-se): [{time, price, quantity, pnl}]
    partials: list | None = None
    # Os reforços (grava-se): [{time, price, quantity, n}]; a quantidade do trade é a inicial
    adds: list | None = None
    # Os ajustes do stop (1, 2…) que aconteceram antes da saída (não se grava)
    stop_rules_fired: list = field(default_factory=list)
    # Por onde andou o stop (grava-se, para o gráfico): [{time, level}]; None se não mexeu
    stop_moves: list | None = None


@dataclass
class Order:
    """Uma entrada ou uma saída: ao mercado ou a um nível, em cada vela."""

    market: bool
    level: np.ndarray
    # Velas em que as condições se cumprem
    active: np.ndarray
    # Velas em que acontece (condições cumpridas e, num nível, o preço lá
    # chegou dentro da vela)
    hits: np.ndarray
    # Com preparação: as velas em que armou, acabou, foi cancelada e deu sinal
    # (`strategy.armed_signal`); sem ela, None
    setup_events: dict | None = None


@dataclass
class Position:
    rule: int
    direction: int
    entry_bar: int
    entry_minute: int
    raw_entry: float
    entry_price: float
    quantity: float
    margin: float
    exit_minute: int
    raw_exit: float
    exit_reason: str
    exit_rule: int | None
    exit_slipped: bool
    order_kind: str = "market"
    wait_bars: int = 0
    slippage_saved: float = 0.0
    stop_level: float | None = None
    take_level: float | None = None
    # As saídas parciais planeadas: (minuto, preço, fração da quantidade inicial)
    partials: list = field(default_factory=list)
    # Os reforços planeados — (minuto, preço sem slippage, fração da quantidade
    # inicial) — e os que entraram: (minuto, preço, quantidade, margem)
    planned_adds: list = field(default_factory=list)
    adds: list = field(default_factory=list)
    # Os ajustes do stop que aconteceram antes da saída e por onde andou o stop
    stop_rules_fired: list = field(default_factory=list)
    stop_moves: list | None = None
    # A liquidação vê-se à parte da saída planeada (que pode cortar): os ajustes do
    # stop (`path`) e o minuto em que passou à entrada, para refazer o caminho do
    # stop; quantos reforços planeados já se viram; a vigia da liquidação (cada
    # mudança dá uma nova, as antigas ignoram-se) e se já fechou
    path: object = None
    moved_at: int | None = None
    adds_done: int = 0
    watch: int = 0
    closed: bool = False


class NoCandlesError(Exception):
    pass

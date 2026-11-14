"""As colunas do relatório: um bloco por coluna JSONB da SimulationRun."""

from __future__ import annotations

# Sobe quando um bloco muda de forma (o ecrã sabe o que está a ler)
VERSION = 1

# As colunas da SimulationRun que o relatório enche (o número é a secção no ecrã)
REPORT_COLUMNS = [
    "summaryMetrics",  # 1.1 os 12 cartões
    "strategyScore",  # 1.1 a nota da estratégia, de 0 a 100, e as 6 partes
    "equityCurve",  # 1.2 o capital contra comprar e manter e o drawdown, um ponto por dia
    "equityInBase",  # 1.2 o capital medido no ativo (dividido pelo preço), um ponto por dia
    "underwater",  # 1.2 a distância ao máximo anterior do índice de performance, um ponto por dia
    "periodReturns",  # 1.3 a tabela dos retornos em % por mês, trimestre e ano
    "horizonReturns",  # 1.3 a estratégia contra comprar e manter nos últimos meses e anos
    "dailyDistribution",  # 1.3 o histograma dos retornos diários e a normal com a mesma média e desvio
    "rollingSharpe",  # 1.3 o Sharpe dos últimos 60 dias, dia a dia
    "monthlyDetail",  # 1.3 mês a mês: trades, stops, custos e resultado (a vista avançada dos retornos)
    "riskMetrics",  # 1.4 os 10 cartões de risco (VaR, CVaR, caudas, Ulcer, pior dia, drawdowns)
    "drawdownEpisodes",  # 1.4 todos os drawdowns (início, fundo, recuperação, profundidade, dias), do pior
    "riskRatios",  # 1.5 os rácios ajustados ao risco, com o buy & hold e a leitura de cada um
    "captureRatios",  # 1.6 captura de subidas e descidas face ao ativo, beta, alpha, correlação e batting average
    "returnsScatter",  # 1.6 os retornos diários do ativo contra os da estratégia, com a reta do beta
    "dataQuality",  # 2.1 as velas que a corrida usou: quantas, em falta, gaps, amplitude, preço e volatilidade
    "signalFunnel",  # 2.2 do sinal ao trade: os sinais, porque não entraram, as ordens e os trades
    "entryBreakdown",  # 2.2 por entrada: sinais, trades, executados, win rate, P&L e expectancy em R
    "setupFunnel",  # 2.2 a preparação de cada entrada: armou, acabou, cancelada, deu sinal e a espera
    "contextRules",  # 2.2 cada condição da conta: os sinais que parou e a estratégia sem ela
    "orderExecution",  # 2.3 as ordens num nível: postas, executadas, caídas, canceladas, espera e slippage poupado
    "orderTypes",  # 2.3 resultado por tipo de ordem (mercado, limite, stop)
    "orderVariants",  # 2.3 variantes da ordem de cada entrada por nível
    "executionVariants",  # 2.3 preço de execução das ordens a mercado (abertura, fecho anterior, 1.º minuto)
    "sampleSplit",  # 3.1 dentro vs fora da amostra: as métricas de cada parte e a degradação
    "sampleEquity",  # 3.1 o capital de cada dia com a linha da divisão
    "entryCards",  # 4.1 os 6 cartões das entradas
    "entryPerformance",  # 4.1 a tabela por entrada (com o retorno sem cada uma)
    "entryEquity",  # 4.1 o P&L acumulado de cada entrada
    "entryExitMatrix",  # 4.2 cada par entrada → saída
    "exitMix",  # 4.2 como sai cada entrada (% por saída)
    "stopCards",  # 4.3 os 8 cartões dos stops
    "exitReasons",  # 4.3 por motivo de saída
    "stopsByMonth",  # 4.3 stops por mês e sequências
    "afterExit",  # 4.4 o que o preço fez depois do take, do stop e do trailing
    "rDistribution",  # 4.5 o resultado por trade em R
    "maeScatter",  # 4.5 a excursão adversa máxima contra o resultado
    "durationBuckets",  # 4.5 duração × resultado
    "sizingSchemes",  # 4.6 os esquemas de risco por entrada, corridos no motor
    "entryKelly",  # 4.6 Kelly e tamanho sugerido por entrada
    "entryCorrelation",  # 4.6 a correlação do P&L semanal entre entradas
    "tradeAnatomy",  # 4.8 os 6 cartões da anatomia do trade
    "tradePath",  # 4.8 o caminho médio do trade em R desde a entrada
    "exitEfficiency",  # 4.8 a eficiência da saída por grupo (MFE, MAE, captura)
    "nextTrade",  # 4.8 o trade seguinte (depois de um ganho, de uma perda…)
    "tradeGroups",  # 4.8 pirâmide, tipo de ordem e ordem no dia
    "stopRuleStats",  # 4.9 cada ajuste do stop: quando aconteceu, as saídas nele e a estratégia sem ele
    "scaleInStats",  # 4.9 cada reforço: os que entraram, os sem capital, com e sem reforço e a estratégia sem ele
    "profileCards",  # 4.10 o perfil de volume: as sessões, as aberturas fora da área de valor, os POC virgens
    "profilePosition",  # 4.10 os trades por onde entraram face à área de valor da sessão anterior
    "profileDistance",  # 4.10 os trades pela distância ao POC da sessão anterior
    "chartLevels",  # gráfico: a máxima/mínima de N velas e os níveis do dia e da semana, vela a vela
    "hourCards",  # 5.1 os 6 cartões das horas de entrada
    "hourEntries",  # 5.1 trades abertos em cada hora, por entrada
    "hourStops",  # 5.1 stops por hora de entrada
    "hourPnl",  # 5.1 P&L por hora de entrada
    "hourTable",  # 5.1 a tabela por hora: sessão, trades, lados, stops, P&L, R, velas e a entrada mais frequente
    "exitHours",  # 5.2 trades fechados em cada hora, por motivo de saída
    "exitHourStops",  # 5.2 stops atingidos por hora de saída
    "exitHourWins",  # 5.2 take profits e trailing (a ganhar) por hora de saída
    "exitHourEntries",  # 5.2 entrada → hora de saída: onde cai o stop de cada entrada
    "weekdayCards",  # 5.3 os 6 cartões dos dias da semana
    "weekdayEntries",  # 5.3 entradas por dia e por tipo de entrada
    "weekdayStops",  # 5.3 stops por dia: pela entrada e pela saída
    "weekdayPnl",  # 5.3 P&L por dia da semana
    "weekdayTable",  # 5.3 a tabela por dia da semana
    "weekdayEntryStops",  # 5.3 stops por dia e entrada
    "weekdayEntryWins",  # 5.3 ganhos por dia e entrada
    "weekdayEntryPnl",  # 5.3 P&L por dia e entrada
    "weekdayHourTrades",  # 5.4 trades por dia × hora de entrada
    "weekdayHourStops",  # 5.4 stops por dia × hora de entrada
    "weekdayHourWinRate",  # 5.4 win rate por dia × hora de entrada
    "weekdayHourPnl",  # 5.4 P&L médio por dia × hora de entrada
    "calendarCards",  # 5.5 os 6 cartões do calendário
    "calendarDaily",  # 5.5 o P&L de cada dia
    "calendarStopDays",  # 5.5 os dias com mais stops
    "calendarBestDays",  # 5.5 os melhores dias
    "calendarMonthDay",  # 5.5 o P&L por dia do mês
    "calendarWeeks",  # 5.5 o P&L de cada semana
    "entryHourProfiles",  # 5.6 cada entrada por hora
    "entryHourBlocks",  # 5.6 entrada × bloco de 4 horas
    "positionDuration",  # 5.7 a duração média por hora de entrada
    "positionHours",  # 5.7 as posições abertas por hora do dia
    "sessionMoments",  # 5.7 os momentos-chave da sessão
    "fundingHours",  # 5.7 as horas de funding
    "durationByWeekday",  # 5.7 a duração por dia da semana e por saída
    "hourFilters",  # 5.8 os filtros de horário corridos no motor
    "hourFilterWorst",  # 5.8 as piores horas dentro vs fora
    "hourFilterBest",  # 5.8 as melhores horas dentro vs fora
    "gapCards",  # 5.9 os 6 cartões dos gaps
    "gapDaily",  # 5.9 a variação da vela das 00h UTC
    "passageGroups",  # 5.9 os trades por tipo de passagem
    "sessionRules",  # 5.9 as regras de sessão corridas no motor
    "worldSessions",  # 5.10 por sessão mundial
    "workHours",  # 5.10 horário de trabalho vs fora de horas
    "sessionEdges",  # 5.10 a primeira e a última hora de cada sessão
    # A robustez (`robustness.py`, a seguir à 3.1) e o veredicto
    "monteCarloCards",  # 3.2 os cartões do Monte Carlo
    "monteCarloFan",  # 3.2 o leque do capital
    "monteCarloDrawdowns",  # 3.2 a distribuição da maior queda
    "walkForwardCards",  # 3.3 os cartões do walk-forward
    "walkForward",  # 3.3 as janelas
    "sensitivityParams",  # 3.4 cada parâmetro × os passos
    "sensitivityGrid",  # 3.4 o mapa dos dois parâmetros que mais mexem
    "costStress",  # 3.5 os custos mais altos
    "regimeTable",  # 3.6 por regime de mercado
    "regimeGrid",  # 3.6 tendência × volatilidade
    "performanceCurve",  # comparar simulações: o retorno acumulado de cada dia
    "verdicts",  # o veredicto e as conclusões de cada ecrã
    "propChallenge",  # 3.8 o desafio de prop firm: as regras, o período todo e o resumo das janelas
    "propWindows",  # 3.8 cada janela do desafio (uma a começar em cada segunda-feira)
]

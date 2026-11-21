import { Transform } from 'class-transformer';
import { ArrayMaxSize, IsArray, IsIn, IsOptional } from 'class-validator';

// Os blocos do relatório de uma simulação: cada um é uma coluna JSONB da
// SimulationRun, que o simulador grava já calculada (o número é a secção no ecrã).
// Um conjunto de mini-cartões é uma coluna; cada gráfico ou tabela, outra
export const REPORT_BLOCKS = [
  'summaryMetrics', // 1.1 Resumo e nota da estratégia: os 12 cartões
  'strategyScore', // 1.1 Nota da estratégia, de 0 a 100
  'equityCurve', // 1.2 Equity e drawdown: o gráfico
  'equityInBase', // 1.2 Equity no ativo: o gráfico
  'underwater', // 1.2 Underwater: o gráfico
  'periodReturns', // 1.3 Retornos: a tabela por mês, trimestre e ano
  'horizonReturns', // 1.3 Por horizonte: a tabela
  'dailyDistribution', // 1.3 Distribuição dos retornos diários: o gráfico
  'rollingSharpe', // 1.3 Sharpe em janela móvel: o gráfico
  'monthlyDetail', // 1.3 Mês a mês: a tabela (a vista avançada dos retornos)
  'riskMetrics', // 1.4 Riscos: os 10 cartões
  'drawdownEpisodes', // 1.4 Os piores drawdowns: a tabela (todos, do pior)
  'riskRatios', // 1.5 Rácios ajustados ao risco: a tabela
  'captureRatios', // 1.6 Captura de subidas e descidas face ao ativo
  'returnsScatter', // 1.6 Retornos diários: ativo vs estratégia (dispersão)
  'dataQuality', // 2.1 Ficha de simulação: a qualidade dos dados
  'signalFunnel', // 2.2 Funil de sinais: do sinal ao trade
  'entryBreakdown', // 2.2 Funil de sinais: por entrada
  'setupFunnel', // 2.2 A preparação de cada entrada
  'contextRules', // 2.2 As condições da conta («só entra se»)
  'orderExecution', // 2.3 Ordens e preço de execução: os cartões
  'orderTypes', // 2.3 Ordens e preço de execução: por tipo de ordem
  'orderVariants', // 2.3 Ordens e preço de execução: variantes da ordem
  'executionVariants', // 2.3 Ordens e preço de execução: preço das ordens a mercado
  'sampleSplit', // 3.1 Dentro vs fora da amostra
  'sampleEquity', // 3.1 Equity com a divisão
  'entryCards', // 4.1 Os 6 cartões das entradas
  'entryPerformance', // 4.1 Por entrada
  'entryEquity', // 4.1 Equity por entrada
  'entryExitMatrix', // 4.2 Entrada → saída
  'exitMix', // 4.2 Como sai cada entrada
  'stopCards', // 4.3 Os 8 cartões dos stops
  'exitReasons', // 4.3 Por motivo de saída
  'stopsByMonth', // 4.3 Stops por mês e sequências
  'afterExit', // 4.4 Depois da saída
  'rDistribution', // 4.5 Resultado por trade em R
  'maeScatter', // 4.5 MAE vs resultado
  'durationBuckets', // 4.5 Duração × resultado
  'sizingSchemes', // 4.6 Esquemas de risco por entrada
  'entryKelly', // 4.6 Kelly e tamanho sugerido
  'entryCorrelation', // 4.6 Correlação entre entradas
  'tradeAnatomy', // 4.8 Anatomia do trade
  'tradePath', // 4.8 Caminho médio do trade
  'exitEfficiency', // 4.8 Eficiência da saída
  'nextTrade', // 4.8 O trade seguinte
  'tradeGroups', // 4.8 Pirâmide, tipo de ordem e ordem no dia
  'stopRuleStats', // 4.9 Os ajustes do stop
  'scaleInStats', // 4.9 Os reforços
  'profileCards', // 4.10 O perfil de volume: os cartões
  'profilePosition', // 4.10 Os trades face à área de valor anterior
  'profileDistance', // 4.10 Os trades pela distância ao POC anterior
  'chartLevels', // Gráfico: os níveis que não são indicadores
  'hourCards', // 5.1 Horas de entrada: os 6 cartões
  'hourEntries', // 5.1 Trades abertos em cada hora, por entrada
  'hourStops', // 5.1 Stops por hora de entrada
  'hourPnl', // 5.1 P&L por hora de entrada
  'hourTable', // 5.1 A tabela por hora de entrada
  'exitHours', // 5.2 Trades fechados em cada hora, por motivo de saída
  'exitHourStops', // 5.2 Stops atingidos por hora de saída
  'exitHourWins', // 5.2 Take profits e trailing por hora de saída
  'exitHourEntries', // 5.2 Entrada → hora de saída
  'weekdayCards', // 5.3 Os 6 cartões dos dias da semana
  'weekdayEntries', // 5.3 Entradas por dia e por tipo de entrada
  'weekdayStops', // 5.3 Stops por dia: entrada vs saída
  'weekdayPnl', // 5.3 P&L por dia da semana
  'weekdayTable', // 5.3 A tabela por dia da semana
  'weekdayEntryStops', // 5.3 Stops por dia e entrada
  'weekdayEntryWins', // 5.3 Ganhos por dia e entrada
  'weekdayEntryPnl', // 5.3 P&L por dia e entrada
  'weekdayHourTrades', // 5.4 Trades por dia × hora de entrada
  'weekdayHourStops', // 5.4 Stops por dia × hora de entrada
  'weekdayHourWinRate', // 5.4 Win rate por dia × hora de entrada
  'weekdayHourPnl', // 5.4 P&L médio por dia × hora de entrada
  'calendarCards', // 5.5 Os 6 cartões do calendário
  'calendarDaily', // 5.5 O P&L de cada dia
  'calendarStopDays', // 5.5 Os dias com mais stops
  'calendarBestDays', // 5.5 Os melhores dias
  'calendarMonthDay', // 5.5 O P&L por dia do mês
  'calendarWeeks', // 5.5 O P&L de cada semana
  'entryHourProfiles', // 5.6 Cada entrada por hora
  'entryHourBlocks', // 5.6 Entrada × bloco de 4 horas
  'positionDuration', // 5.7 Duração média por hora de entrada
  'positionHours', // 5.7 Posições abertas por hora do dia
  'sessionMoments', // 5.7 Momentos-chave da sessão
  'fundingHours', // 5.7 Horas de funding
  'durationByWeekday', // 5.7 Duração por dia da semana e por saída
  'hourFilters', // 5.8 Filtros de horário corridos no motor
  'hourFilterWorst', // 5.8 Piores horas dentro vs fora da amostra
  'hourFilterBest', // 5.8 Melhores horas dentro vs fora da amostra
  'gapCards', // 5.9 Os 6 cartões dos gaps
  'gapDaily', // 5.9 Variação na vela das 00h UTC
  'passageGroups', // 5.9 Trades por tipo de passagem
  'sessionRules', // 5.9 Regras de sessão corridas no motor
  'worldSessions', // 5.10 Por sessão mundial
  'workHours', // 5.10 Horário de trabalho vs fora de horas
  'sessionEdges', // 5.10 Primeira e última hora de cada sessão
  'monteCarloCards', // 3.2 Os cartões do Monte Carlo
  'monteCarloFan', // 3.2 O leque do capital (percentis)
  'monteCarloDrawdowns', // 3.2 A distribuição da maior queda
  'walkForwardCards', // 3.3 Os cartões do walk-forward
  'walkForward', // 3.3 As janelas do walk-forward
  'sensitivityParams', // 3.4 Cada parâmetro × os passos
  'sensitivityGrid', // 3.4 O mapa dos dois parâmetros que mais mexem
  'costStress', // 3.5 Os custos mais altos
  'regimeTable', // 3.6 Por regime de mercado
  'regimeGrid', // 3.6 Tendência × volatilidade
  'performanceCurve', // Comparar simulações: o retorno acumulado de cada dia
  'verdicts', // O veredicto e as conclusões de cada ecrã
  'propChallenge', // 3.8 O desafio de prop firm: as regras, o período todo e as janelas
  'propWindows', // 3.8 Cada janela do desafio
] as const;

export type ReportBlock = (typeof REPORT_BLOCKS)[number];

/** Os blocos que se querem, separados por vírgulas (?blocks=summaryMetrics); sem eles, todos. */
export class FindReportQueryDto {
  @IsOptional()
  @Transform(({ value }: { value: unknown }) =>
    typeof value === 'string'
      ? value
          .split(',')
          .map((block) => block.trim())
          .filter(Boolean)
      : value,
  )
  @IsArray()
  @ArrayMaxSize(REPORT_BLOCKS.length)
  @IsIn(REPORT_BLOCKS, { each: true })
  blocks?: ReportBlock[];
}

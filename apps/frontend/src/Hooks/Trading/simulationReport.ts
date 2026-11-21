import type { Run_Status } from './simulationRun';
import type { Summary_Metrics, Strategy_Score, Chart_Equity_Curve, Chart_Equity_In_Base, Chart_Underwater, Table_Period_Returns, Table_Horizon_Returns, Chart_Daily_Distribution, Chart_Rolling_Sharpe, Table_Monthly_Detail, Risk_Metrics, Table_Drawdown_Episodes, Table_Risk_Ratios, Capture_Ratios, Chart_Returns_Scatter } from './reportSummary';
import type { Data_Quality, Signal_Funnel, Entry_Breakdown, Setup_Funnel, Context_Rules, Order_Execution, Order_Types, Order_Variants, Execution_Variants } from './reportSetup';
import type { Sample_Split, Sample_Equity, Monte_Carlo_Cards, Monte_Carlo_Fan, Monte_Carlo_Drawdowns, Walk_Forward_Cards, Walk_Forward, Sensitivity_Params, Sensitivity_Grid, Cost_Stress, Regime_Table, Regime_Grid, Performance_Curve, Verdicts, Prop_Challenge, Prop_Windows } from './reportProofs';
import type { Stop_Rule_Stats, Profile_Cards, Profile_Groups, Scale_In_Stats, Chart_Levels, Entry_Performance, Entry_Cards, Entry_Equity, Entry_Exit_Matrix, Exit_Mix, Stop_Cards, Exit_Reasons, Stops_By_Month, After_Exit, R_Distribution, Mae_Scatter, Duration_Buckets, Sizing_Schemes, Entry_Kelly, Entry_Correlation, Trade_Anatomy, Trade_Path, Exit_Efficiency, Next_Trade, Trade_Groups } from './reportEntries';
import type { Hour_Cards, Hour_Entries, Hour_Stops, Hour_Pnl, Hour_Table, Exit_Hours, Exit_Hour_Stops, Exit_Hour_Wins, Exit_Hour_Entries, Weekday_Cards, Weekday_Entries, Weekday_Stops, Weekday_Pnl, Weekday_Table, Weekday_Entry_Counts, Weekday_Entry_Pnl, Weekday_Hour_Trades, Weekday_Hour_Stops, Weekday_Hour_Win_Rate, Weekday_Hour_Pnl, Calendar_Cards, Calendar_Daily, Calendar_Stop_Days, Calendar_Best_Days, Calendar_Month_Day, Calendar_Weeks, Entry_Hour_Profiles, Entry_Hour_Blocks, Position_Duration, Position_Hours, Session_Moments, Funding_Hours, Duration_By_Weekday, Hour_Filters, Hour_Filter_Sample, Gap_Cards, Gap_Daily, Passage_Groups, Session_Rules, World_Sessions, Work_Hours, Session_Edges } from './reportHours';

// Os blocos de cada ecrã estão nos ficheiros report*.ts; ficam também exportados daqui
export * from './reportSummary';
export * from './reportSetup';
export * from './reportProofs';
export * from './reportEntries';
export * from './reportHours';

// Os blocos do relatório que o simulador grava (um por coluna JSONB da SimulationRun)

// Os blocos do relatório: cada um é uma coluna da SimulationRun, que o simulador
// grava já calculada (o ecrã só mostra). Pedem-se à parte, só os que se querem
export type Report_Block = 'summaryMetrics' | 'strategyScore' | 'equityCurve' | 'equityInBase' | 'underwater' | 'periodReturns' | 'horizonReturns' | 'dailyDistribution' | 'rollingSharpe' | 'monthlyDetail' | 'riskMetrics' | 'drawdownEpisodes' | 'riskRatios' | 'captureRatios' | 'returnsScatter' | 'dataQuality' | 'signalFunnel' | 'entryBreakdown' | 'setupFunnel' | 'contextRules' | 'orderExecution' | 'orderTypes' | 'orderVariants' | 'executionVariants' | 'sampleSplit' | 'sampleEquity' | 'entryCards' | 'entryPerformance' | 'entryEquity' | 'entryExitMatrix' | 'exitMix' | 'stopCards' | 'exitReasons' | 'stopsByMonth' | 'afterExit' | 'rDistribution' | 'maeScatter' | 'durationBuckets' | 'sizingSchemes' | 'entryKelly' | 'entryCorrelation' | 'tradeAnatomy' | 'tradePath' | 'exitEfficiency' | 'nextTrade' | 'tradeGroups' | 'stopRuleStats' | 'scaleInStats' | 'profileCards' | 'profilePosition' | 'profileDistance' | 'chartLevels' | 'hourCards' | 'hourEntries' | 'hourStops' | 'hourPnl' | 'hourTable' | 'exitHours' | 'exitHourStops' | 'exitHourWins' | 'exitHourEntries'
  | 'weekdayCards' | 'weekdayEntries' | 'weekdayStops' | 'weekdayPnl' | 'weekdayTable'
  | 'weekdayEntryStops' | 'weekdayEntryWins' | 'weekdayEntryPnl'
  | 'weekdayHourTrades' | 'weekdayHourStops' | 'weekdayHourWinRate' | 'weekdayHourPnl'
  | 'calendarCards' | 'calendarDaily' | 'calendarStopDays' | 'calendarBestDays' | 'calendarMonthDay' | 'calendarWeeks'
  | 'entryHourProfiles' | 'entryHourBlocks'
  | 'positionDuration' | 'positionHours' | 'sessionMoments' | 'fundingHours' | 'durationByWeekday'
  | 'hourFilters' | 'hourFilterWorst' | 'hourFilterBest'
  | 'gapCards' | 'gapDaily' | 'passageGroups' | 'sessionRules'
  | 'worldSessions' | 'workHours' | 'sessionEdges'
  | 'monteCarloCards' | 'monteCarloFan' | 'monteCarloDrawdowns' | 'walkForwardCards' | 'walkForward'
  | 'sensitivityParams' | 'sensitivityGrid' | 'costStress' | 'regimeTable' | 'regimeGrid'
  | 'performanceCurve' | 'verdicts' | 'propChallenge' | 'propWindows';

// O que GET /simulations/:id/report devolve: o estado e os blocos pedidos
// (null numa simulação anterior ao relatório)
export interface Simulation_Report {
  status: Run_Status;
  summaryMetrics?: Summary_Metrics | null;
  strategyScore?: Strategy_Score | null;
  equityCurve?: Chart_Equity_Curve | null;
  equityInBase?: Chart_Equity_In_Base | null;
  underwater?: Chart_Underwater | null;
  periodReturns?: Table_Period_Returns | null;
  horizonReturns?: Table_Horizon_Returns | null;
  dailyDistribution?: Chart_Daily_Distribution | null;
  rollingSharpe?: Chart_Rolling_Sharpe | null;
  monthlyDetail?: Table_Monthly_Detail | null;
  riskMetrics?: Risk_Metrics | null;
  drawdownEpisodes?: Table_Drawdown_Episodes | null;
  riskRatios?: Table_Risk_Ratios | null;
  captureRatios?: Capture_Ratios | null;
  returnsScatter?: Chart_Returns_Scatter | null;
  dataQuality?: Data_Quality | null;
  signalFunnel?: Signal_Funnel | null;
  entryBreakdown?: Entry_Breakdown | null;
  setupFunnel?: Setup_Funnel | null;
  contextRules?: Context_Rules | null;
  orderExecution?: Order_Execution | null;
  orderTypes?: Order_Types | null;
  orderVariants?: Order_Variants | null;
  executionVariants?: Execution_Variants | null;
  sampleSplit?: Sample_Split | null;
  sampleEquity?: Sample_Equity | null;
  entryCards?: Entry_Cards | null;
  entryPerformance?: Entry_Performance | null;
  entryEquity?: Entry_Equity | null;
  entryExitMatrix?: Entry_Exit_Matrix | null;
  exitMix?: Exit_Mix | null;
  stopCards?: Stop_Cards | null;
  exitReasons?: Exit_Reasons | null;
  stopsByMonth?: Stops_By_Month | null;
  afterExit?: After_Exit | null;
  rDistribution?: R_Distribution | null;
  maeScatter?: Mae_Scatter | null;
  durationBuckets?: Duration_Buckets | null;
  sizingSchemes?: Sizing_Schemes | null;
  entryKelly?: Entry_Kelly | null;
  entryCorrelation?: Entry_Correlation | null;
  tradeAnatomy?: Trade_Anatomy | null;
  tradePath?: Trade_Path | null;
  exitEfficiency?: Exit_Efficiency | null;
  nextTrade?: Next_Trade | null;
  tradeGroups?: Trade_Groups | null;
  stopRuleStats?: Stop_Rule_Stats | null;
  scaleInStats?: Scale_In_Stats | null;
  profileCards?: Profile_Cards | null;
  profilePosition?: Profile_Groups | null;
  profileDistance?: Profile_Groups | null;
  chartLevels?: Chart_Levels | null;
  hourCards?: Hour_Cards | null;
  hourEntries?: Hour_Entries | null;
  hourStops?: Hour_Stops | null;
  hourPnl?: Hour_Pnl | null;
  hourTable?: Hour_Table | null;
  exitHours?: Exit_Hours | null;
  exitHourStops?: Exit_Hour_Stops | null;
  exitHourWins?: Exit_Hour_Wins | null;
  exitHourEntries?: Exit_Hour_Entries | null;
  weekdayCards?: Weekday_Cards | null;
  weekdayEntries?: Weekday_Entries | null;
  weekdayStops?: Weekday_Stops | null;
  weekdayPnl?: Weekday_Pnl | null;
  weekdayTable?: Weekday_Table | null;
  weekdayEntryStops?: Weekday_Entry_Counts | null;
  weekdayEntryWins?: Weekday_Entry_Counts | null;
  weekdayEntryPnl?: Weekday_Entry_Pnl | null;
  weekdayHourTrades?: Weekday_Hour_Trades | null;
  weekdayHourStops?: Weekday_Hour_Stops | null;
  weekdayHourWinRate?: Weekday_Hour_Win_Rate | null;
  weekdayHourPnl?: Weekday_Hour_Pnl | null;
  calendarCards?: Calendar_Cards | null;
  calendarDaily?: Calendar_Daily | null;
  calendarStopDays?: Calendar_Stop_Days | null;
  calendarBestDays?: Calendar_Best_Days | null;
  calendarMonthDay?: Calendar_Month_Day | null;
  calendarWeeks?: Calendar_Weeks | null;
  entryHourProfiles?: Entry_Hour_Profiles | null;
  entryHourBlocks?: Entry_Hour_Blocks | null;
  positionDuration?: Position_Duration | null;
  positionHours?: Position_Hours | null;
  sessionMoments?: Session_Moments | null;
  fundingHours?: Funding_Hours | null;
  durationByWeekday?: Duration_By_Weekday | null;
  hourFilters?: Hour_Filters | null;
  hourFilterWorst?: Hour_Filter_Sample | null;
  hourFilterBest?: Hour_Filter_Sample | null;
  gapCards?: Gap_Cards | null;
  gapDaily?: Gap_Daily | null;
  passageGroups?: Passage_Groups | null;
  sessionRules?: Session_Rules | null;
  worldSessions?: World_Sessions | null;
  workHours?: Work_Hours | null;
  sessionEdges?: Session_Edges | null;
  monteCarloCards?: Monte_Carlo_Cards | null;
  monteCarloFan?: Monte_Carlo_Fan | null;
  monteCarloDrawdowns?: Monte_Carlo_Drawdowns | null;
  walkForwardCards?: Walk_Forward_Cards | null;
  walkForward?: Walk_Forward | null;
  sensitivityParams?: Sensitivity_Params | null;
  sensitivityGrid?: Sensitivity_Grid | null;
  costStress?: Cost_Stress | null;
  regimeTable?: Regime_Table | null;
  regimeGrid?: Regime_Grid | null;
  performanceCurve?: Performance_Curve | null;
  verdicts?: Verdicts | null;
  propChallenge?: Prop_Challenge | null;
  propWindows?: Prop_Windows | null;
}

// Ecrã 5, os Horários: os blocos 5.1 a 5.10 do relatório

// 5.1 — Horas de entrada (na hora local da simulação, com a mudança de hora)
export interface Hour_Cards {
  version: number;
  timezone: string;
  trades: number;
  busiest: { hour: number; trades: number; pct: number | null } | null;
  mostStopsEntry: { hour: number; stops: number; trades: number } | null;
  mostStopsExit: { hour: number; stops: number } | null;
  best: { hour: number; pnl: number; winRate: number | null } | null;
  worst: { hour: number; pnl: number; stopsPct: number | null } | null;
  emptyHours: number[];
}

export interface Hour_Entries {
  version: number;
  timezone: string;
  // Os trades de cada entrada em cada hora (0 a 23)
  entries: { rule: number; counts: number[] }[];
  totals: number[];
}

export interface Hour_Stops {
  version: number;
  timezone: string;
  columns: ['hour', 'trades', 'stops', 'stopsPct'];
  hours: [number, number, number, number | null][];
}

export interface Hour_Pnl {
  version: number;
  timezone: string;
  // Abaixo destes trades a hora é amostra pequena (o ecrã esbate-a)
  minTrades?: number;
  columns: ['hour', 'trades', 'pnl', 'winRate'];
  hours: [number, number, number, number | null][];
}

export interface Hour_Table {
  version: number;
  timezone: string;
  rows: {
    hour: number;
    session: 'asia' | 'europe' | 'overlap' | 'us' | 'night';
    trades: number;
    pct: number | null;
    longs: number;
    shorts: number;
    winRatePct: number | null;
    stops: number;
    stopsPct: number | null;
    pnl: number;
    expectancy: number | null;
    avgR: number | null;
    avgBars: number | null;
    topEntry: { rule: number; trades: number } | null;
  }[];
}

// 5.2 — Horas de saída (na hora local da simulação)
export interface Exit_Hours {
  version: number;
  timezone: string;
  // Os trades fechados em cada hora (0 a 23) por motivo de saída
  reasons: { reason: string; counts: number[] }[];
  totals: number[];
}

export interface Exit_Hour_Stops {
  version: number;
  timezone: string;
  // As horas da madrugada (pouca liquidez), noutro tom
  nightHours: number[];
  columns: ['hour', 'stops'];
  hours: [number, number][];
}

export interface Exit_Hour_Wins {
  version: number;
  timezone: string;
  columns: ['hour', 'wins', 'takeProfit', 'trailingStop', 'breakEven'];
  hours: [number, number, number, number, number][];
}

export interface Exit_Hour_Entries {
  version: number;
  timezone: string;
  nightHours: number[];
  rows: {
    rule: number;
    trades: number;
    stops: number;
    topStopHours: { hour: number; stops: number }[];
    avgEntryHour: number | null;
    avgExitHour: number | null;
    topWinHour: { hour: number; trades: number } | null;
    firstHourStops: number;
    firstHourPct: number | null;
    nightStops: number;
    nightPct: number | null;
  }[];
}

// 5.3 — Dias da semana (0 = segunda, no dia local em que o trade abriu)
interface Weekday_Part {
  trades: number;
  pnl: number;
  winRatePct: number | null;
  stopsPct: number | null;
}

export interface Weekday_Cards {
  version: number;
  timezone: string;
  busiest: { day: number; trades: number; perDay: number | null } | null;
  mostStops: { day: number; stopsPct: number; stops: number } | null;
  best: { day: number; pnl: number; avgR: number | null } | null;
  worst: { day: number; pnl: number; avgR: number | null } | null;
  // Segunda a sexta e o fim de semana
  week: Weekday_Part;
  weekend: Weekday_Part;
}

export interface Weekday_Entries {
  version: number;
  timezone: string;
  entries: { rule: number; counts: number[] }[];
  totals: number[];
}

export interface Weekday_Stops {
  version: number;
  timezone: string;
  // Os stops dos trades abertos no dia e os atingidos no dia
  columns: ['day', 'entryStops', 'exitStops'];
  days: [number, number, number][];
}

export interface Weekday_Pnl {
  version: number;
  timezone: string;
  minTrades?: number;
  columns: ['day', 'trades', 'pnl', 'winRate', 'avgR'];
  days: [number, number, number, number | null, number | null][];
}

export interface Weekday_Table {
  version: number;
  timezone: string;
  rows: {
    day: number;
    // Quantos dias desse tipo tem o período
    days: number;
    trades: number;
    perDay: number | null;
    winRatePct: number | null;
    stops: number;
    stopsPct: number | null;
    exitStops: number;
    pnl: number;
    expectancy: number | null;
    avgR: number | null;
    avgBars: number | null;
    worstStreak: number;
    bestEntry: { rule: number; pnl: number } | null;
    worstEntry: { rule: number; pnl: number } | null;
  }[];
}

export interface Weekday_Entry_Counts {
  version: number;
  timezone: string;
  entries: { rule: number; counts: number[] }[];
}

export interface Weekday_Entry_Pnl {
  version: number;
  timezone: string;
  entries: { rule: number; pnl: number[] }[];
}

// 5.4: dia da semana × hora de entrada; cada quadro tem 7 linhas (0 = segunda) × 24 horas
export interface Weekday_Hour_Trades {
  version: number;
  timezone: string;
  // Abaixo destes trades a célula é amostra pequena (o ecrã esbate-a)
  minTrades?: number;
  trades: number[][];
  max: number;
}

export interface Weekday_Hour_Stops {
  version: number;
  timezone: string;
  // Nulo = sem trades
  stops: (number | null)[][];
  trades: number[][];
  max: number;
}

export interface Weekday_Hour_Win_Rate {
  version: number;
  timezone: string;
  // Os trades a partir dos quais há win rate
  minTrades: number;
  // De 0 a 100; nulo = sem trades ou menos de `minTrades`
  winRatePct: (number | null)[][];
  wins: number[][];
  trades: number[][];
}

export interface Weekday_Hour_Pnl {
  version: number;
  timezone: string;
  minTrades?: number;
  // Nulo = sem trades
  avgPnl: (number | null)[][];
  pnl: (number | null)[][];
  trades: number[][];
  // O limite da escala das cores (simétrica à volta do 0); nulo = sem trades
  scale: number | null;
}

// 5.5: o calendário, por dia local (o P&L da equity; trades e stops pelo dia em que fecharam)
export interface Calendar_Day {
  date: string;
  // 0 = segunda
  weekday: number;
  pnl: number;
  trades: number;
  stops: number;
}

export interface Calendar_Cards {
  version: number;
  timezone: string;
  days: number;
  tradeDays: number;
  tradeDaysPct: number | null;
  positiveDays: number;
  negativeDays: number;
  // Dos dias com movimento
  positivePct: number | null;
  best: Calendar_Day | null;
  worst: Calendar_Day | null;
  winStreak: number;
  lossStreak: number;
  // Dias com 2 ou mais stops
  stopDays: number;
}

export interface Calendar_Daily {
  version: number;
  timezone: string;
  columns: ['date', 'pnl', 'trades', 'stops'];
  days: [string, number, number, number][];
  // O limite da escala das cores (simétrica à volta do 0); nulo = nenhum dia com movimento
  scale: number | null;
  // Abaixo disto (em módulo) o dia conta como sem movimento
  flat: number;
}

export interface Calendar_Entry_Count {
  rule: number;
  count: number;
}

export interface Calendar_Stop_Days {
  version: number;
  timezone: string;
  rows: (Calendar_Day & { entries: Calendar_Entry_Count[] })[];
}

export interface Calendar_Best_Days {
  version: number;
  timezone: string;
  netProfit: number;
  rows: (Calendar_Day & { profitPct: number | null; entries: Calendar_Entry_Count[] })[];
}

export interface Calendar_Month_Day {
  version: number;
  timezone: string;
  // Dias 1 a 31
  pnl: number[];
  first5: number;
  last5: number;
}

export interface Calendar_Weeks {
  version: number;
  timezone: string;
  columns: ['start', 'pnl', 'stops'];
  weeks: [string, number, number][];
  positive: number;
  first: string | null;
  last: string | null;
}

// 5.6: cada entrada por hora de entrada (24 valores em cada lista)
export interface Entry_Hour_Profile {
  rule: number;
  trades: number;
  stops: number;
  wins: number[];
  stopHours: number[];
  others: number[];
  pnl: number[];
  // As horas em que o horário da entrada deixa entrar; nulo = sem horário
  band: number[] | null;
  busiest: { hour: number; trades: number } | null;
  best: { hour: number; pnl: number; winRatePct: number } | null;
  mostStops: { hour: number; stops: number; trades: number } | null;
}

export interface Entry_Hour_Profiles {
  version: number;
  timezone: string;
  entries: Entry_Hour_Profile[];
}

export interface Entry_Hour_Block_Cell {
  trades: number;
  winRatePct: number;
  pnl: number;
  expectancy: number;
}

export interface Entry_Hour_Blocks {
  version: number;
  timezone: string;
  minTrades?: number;
  blockHours: number;
  // Cada linha: uma célula por bloco (nula = sem trades) e o melhor e o pior bloco (índices)
  rows: { rule: number; cells: (Entry_Hour_Block_Cell | null)[]; best: number | null; worst: number | null }[];
  scale: number | null;
}

// 5.7: o tempo em posição
export interface Position_Duration {
  version: number;
  timezone: string;
  columns: ['hour', 'trades', 'avgBars'];
  hours: [number, number, number | null][];
}

export interface Position_Hours {
  version: number;
  timezone: string;
  // As posições abertas em média em cada hora local (pelo tempo)
  open: (number | null)[];
  nightHours: number[];
}

export interface Session_Moment {
  moment: 'dailyClose' | 'nyOpen' | 'nyClose';
  // As horas locais (HH:MM) em que o momento cai, da mais frequente
  localTimes: string[];
  count: number;
  withPosition: number;
  pct: number | null;
  trades: number;
  pnl: number;
}

export interface Session_Moments {
  version: number;
  timezone: string;
  moments: Session_Moment[];
}

export interface Funding_Hours {
  version: number;
  timezone: string;
  // Sem funding na simulação, `paid` é nulo
  funding: boolean;
  charges: { hour: number; localTimes: string[]; count: number; withPosition: number; pct: number | null; paid: number | null }[];
}

export interface Duration_By_Weekday {
  version: number;
  timezone: string;
  // Os motivos de saída das colunas, pela ordem
  reasons: string[];
  rows: { day: number; trades: number; avgBars: number | null; byExit: (number | null)[] }[];
}

// 5.8 e 5.9: uma variante corrida no motor (retornos em %, a queda negativa,
// dentro e fora da amostra divididos como na 3.1)
export interface Variant_Numbers {
  trades: number;
  stops: number;
  returnPct: number;
  maxDrawdownPct: number;
  deltaPct: number;
  inReturnPct: number | null;
  outReturnPct: number | null;
  deltaOutPct: number | null;
}

export interface Hour_Filter_Row extends Variant_Numbers {
  // 'current' é a estratégia como está
  filter: 'current' | 'worstHours' | 'stopHours' | 'worstDay' | 'bestHours' | 'worstHoursDay' | 'exitStopHour' | 'night' | 'opens' | 'weekdays';
  // As horas locais e os dias (0 = segunda) bloqueados; em 'bestHours', `keep` são as que ficam
  hours: number[];
  days: number[];
  keep: number[];
  signalsBlocked: number;
}

export interface Hour_Filters {
  version: number;
  timezone: string;
  splitTime: number;
  configured: boolean;
  rows: Hour_Filter_Row[];
}

export interface Hour_Sample_Stats {
  trades: number;
  expectancy: number | null;
  stopsPct: number | null;
  winRatePct: number | null;
}

export interface Hour_Filter_Sample {
  version: number;
  timezone: string;
  minTrades: number;
  // `holds`: a expectancy fora tem o mesmo sinal que dentro (nulo sem trades fora)
  rows: { hour: number; inside: Hour_Sample_Stats; outside: Hour_Sample_Stats; holds: boolean | null }[];
}

export interface Gap_Cards {
  version: number;
  timezone: string;
  days: number;
  mondays: number;
  meanAbsPct: number | null;
  biggest: { date: string; pct: number } | null;
  crossing: number;
  crossingPct: number | null;
  weekend: number;
  gapStops: number;
  gapCost: number;
}

export interface Gap_Daily {
  version: number;
  timezone: string;
  columns: ['date', 'pct'];
  days: [string, number][];
  meanAbsPct: number | null;
  mondayMeanAbsPct: number | null;
  maxAbsPct: number | null;
}

export interface Passage_Groups {
  version: number;
  timezone: string;
  rows: {
    group: 'sameDay' | 'daily' | 'weekend' | 'long' | 'short' | 'all';
    trades: number;
    pnl: number;
    stops: number;
    stopsPct: number | null;
    gapStops: number;
  }[];
}

export interface Session_Rules {
  version: number;
  timezone: string;
  rows: (Variant_Numbers & { rule: 'current' | 'weekendClose' | 'weekendNoEntry' | 'nyClose' | 'noMidnight' })[];
}

export interface Session_Summary {
  trades: number;
  winRatePct: number | null;
  stops: number;
  stopsPct: number | null;
  pnl: number;
  expectancy: number | null;
}

export interface World_Sessions {
  version: number;
  timezone: string;
  // As horas UTC de `from` a `to` (exclusivo); a volatilidade é a amplitude média das velas de 1 hora, em %
  rows: (Session_Summary & { session: string; from: number; to: number; volatilityPct: number | null })[];
}

export interface Work_Hours {
  version: number;
  timezone: string;
  // 'offset' é uma diferença para UTC (inverno e verão), em horas
  rows: (Session_Summary & { period: 'work' | 'evening' | 'night' | 'weekend' | 'offset'; hours: number; perHundred: number | null; offset?: number })[];
  workPnl: number;
  offPnl: number;
}

export interface Session_Edges {
  version: number;
  timezone: string;
  rows: { session: string; first: number; last: number; firstHour: Session_Summary; lastHour: Session_Summary; rest: Session_Summary }[];
}

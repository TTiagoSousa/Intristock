import type { Market_Instrument } from '../../../../Hooks/Trading/useMarketInstruments';
import type {
  Cooldown_After,
  Deposit_Period,
  Duration_Unit,
  Execution_Price,
  Guard_Event,
  Margin_Mode,
  Max_Loss_Mode,
  Opposite_Mode,
  Schedule_Mode,
  Schedule_Payload,
  Simulation_Options_Payload,
  Simulation_Run,
  Sizing_Action,
  Streak,
} from '../../../../Hooks/Trading/useSimulation';

/**
 * O que é geral à simulação (não de uma entrada): as opções que se ligam uma a
 * uma (depósitos, funding, execução, posições, horários…), as regras de "não
 * operar se", a margem e o fuso horário. Desligada, uma opção vale o normal e
 * não vai no pedido.
 */

export type Option_Key =
  | 'deposits'
  | 'funding'
  | 'execution'
  | 'slippage'
  | 'orderSize'
  | 'outOfSample'
  | 'propFirm'
  | 'positions'
  | 'opposite'
  | 'cooldown'
  | 'sizingRules'
  | 'schedule'
  | 'excluded';

// Só fazem sentido nos futuros
const FUTURES_OPTIONS: Option_Key[] = ['funding'];

export const EXECUTION_PRICES: Execution_Price[] = ['open', 'signal_close', 'first_minute_avg'];
export const DEPOSIT_PERIODS: Deposit_Period[] = ['month', 'quarter', 'year'];
export const OPPOSITE_MODES: Opposite_Mode[] = ['ignore', 'close', 'reverse', 'hedge'];
export const SIZING_ACTIONS: Sizing_Action[] = ['set', 'multiply', 'reset'];
export const STREAKS: Streak[] = ['losses', 'wins'];
export const GUARD_EVENTS: Guard_Event[] = ['stops', 'losses', 'lossStreak', 'lossAmount', 'lossPct'];
export const DURATION_UNITS: Duration_Unit[] = ['hours', 'days', 'weeks'];
export const MAX_LOSS_MODES: Max_Loss_Mode[] = ['static', 'trailing'];
export const MAX_SIZING_RULES = 5;
export const MAX_SCHEDULE_RULES = 10;
export const MAX_EXCLUDED_PERIODS = 20;
export const MAX_GUARDS = 10;
// 0 = segunda … 6 = domingo, como o motor
export const WEEKDAYS = [0, 1, 2, 3, 4, 5, 6];

export interface Sizing_Rule_Form {
  id: number;
  after: Streak;
  count: string;
  action: Sizing_Action;
  value: string;
  // Entradas com o valor ajustado ('' ou 0 = até outra regra)
  trades: string;
}

// Uma regra de horário: dias (nenhum = todos) e horas 'HH:MM' (as duas vazias = o dia todo)
export interface Schedule_Rule_Form {
  id: number;
  days: number[];
  from: string;
  to: string;
}

// Um horário de uma entrada, stop ou saída: só nestas regras, ou exceto nelas
export interface Schedule_Form {
  mode: Schedule_Mode;
  rules: Schedule_Rule_Form[];
}

export interface Excluded_Period_Form {
  id: number;
  from: string;
  to: string;
}

export interface Guard_Form {
  id: number;
  event: Guard_Event;
  value: string;
  // Janela ('' = desde o início; não conta nas perdas seguidas)
  windowCount: string;
  windowUnit: Duration_Unit;
  pauseCount: string;
  pauseUnit: Duration_Unit;
}

export interface Options_Form {
  enabled: Option_Key[];
  // O fuso de todos os horários (das entradas, stops, saídas e gerais) e dos dias
  timezone: string;
  depositEvery: Deposit_Period;
  depositAmount: string;
  // O aumento do depósito ('' = sem aumento)
  depositIncreaseEvery: 'quarter' | 'year' | '';
  depositIncreaseAmount: string;
  fundingMode: 'historical' | 'fixed';
  fundingRatePct: string;
  // Nos futuros: a margem e a manutenção (a alavancagem é de cada entrada)
  marginMode: Margin_Mode;
  maintenancePct: string;
  executionPrice: Execution_Price;
  slippagePct: string;
  quantityStep: string;
  minQuantity: string;
  minNotional: string;
  outOfSamplePct: string;
  // O desafio de prop firm: cada % vazia é uma regra que não conta
  propDailyLossPct: string;
  propMaxLossPct: string;
  propMaxLossMode: Max_Loss_Mode;
  propTargetPct: string;
  propMinDays: string;
  propDays: string;
  maxPositions: string;
  opposite: Opposite_Mode;
  cooldownBars: string;
  cooldownAfter: Cooldown_After;
  sizingRules: Sizing_Rule_Form[];
  blockedTimes: Schedule_Rule_Form[];
  excludedPeriods: Excluded_Period_Form[];
  guards: Guard_Form[];
}

let nextId = 1;
const newId = () => nextId++;

// Os fusos que o browser conhece, com o UTC à cabeça
const knownZones = () => {
  try {
    return Intl.supportedValuesOf('timeZone');
  } catch {
    return [];
  }
};
export const TIMEZONES = ['UTC', ...knownZones().filter((zone) => zone !== 'UTC')];

// O fuso do browser: as horas leem-se como o utilizador as vê
export const browserTimezone = () => {
  try {
    return Intl.DateTimeFormat().resolvedOptions().timeZone || 'UTC';
  } catch {
    return 'UTC';
  }
};

export const newSizingRule = (patch: Partial<Sizing_Rule_Form> = {}): Sizing_Rule_Form => ({
  id: newId(),
  after: 'losses',
  count: '3',
  action: 'multiply',
  value: '0.5',
  trades: '5',
  ...patch,
});

export const newScheduleRule = (patch: Partial<Schedule_Rule_Form> = {}): Schedule_Rule_Form => ({
  id: newId(),
  days: [5, 6],
  from: '',
  to: '',
  ...patch,
});

export const newSchedule = (mode: Schedule_Mode): Schedule_Form => ({ mode, rules: [newScheduleRule()] });

export const newExcludedPeriod = (patch: Partial<Excluded_Period_Form> = {}): Excluded_Period_Form => ({
  id: newId(),
  from: '',
  to: '',
  ...patch,
});

export const newGuard = (patch: Partial<Guard_Form> = {}): Guard_Form => ({
  id: newId(),
  event: 'stops',
  value: '3',
  windowCount: '1',
  windowUnit: 'days',
  pauseCount: '1',
  pauseUnit: 'days',
  ...patch,
});

export const defaultOptions = (): Options_Form => ({
  enabled: [],
  timezone: browserTimezone(),
  depositEvery: 'month',
  depositAmount: '100',
  depositIncreaseEvery: '',
  depositIncreaseAmount: '50',
  fundingMode: 'historical',
  fundingRatePct: '0.01',
  marginMode: 'isolated',
  maintenancePct: '0.5',
  executionPrice: 'open',
  slippagePct: '0.05',
  quantityStep: '',
  minQuantity: '',
  minNotional: '',
  outOfSamplePct: '70',
  // Os valores de um desafio de duas fases habitual (fase 1)
  propDailyLossPct: '5',
  propMaxLossPct: '10',
  propMaxLossMode: 'static',
  propTargetPct: '10',
  propMinDays: '4',
  propDays: '30',
  maxPositions: '2',
  opposite: 'reverse',
  cooldownBars: '3',
  cooldownAfter: 'loss',
  sizingRules: [newSizingRule()],
  blockedTimes: [newScheduleRule()],
  excludedPeriods: [newExcludedPeriod()],
  guards: [],
});

/** Se a opção existe para este mercado (as de futuros não aparecem no spot). */
export const optionAvailable = (key: Option_Key, instrument: Market_Instrument | null) =>
  !(FUTURES_OPTIONS.includes(key) && instrument?.type === 'spot');

/** Os mínimos da corretora para o mercado escolhido, se o catálogo os tiver. */
export const brokerLimits = (instrument: Market_Instrument | null) => ({
  quantityStep: instrument?.metadata?.stepSize ? String(Number(instrument.metadata.stepSize)) : '',
  minQuantity: instrument?.metadata?.minQty ? String(Number(instrument.metadata.minQty)) : '',
  minNotional: instrument?.metadata?.minNotional ? String(Number(instrument.metadata.minNotional)) : '',
});

// As comissões do nível normal de cada corretora (sem volume nem desconto), em %:
// a Binance no spot e nos futuros USDⓈ-M; a Coinbase Exchange, e nos pares de
// stablecoins (as duas moedas estáveis, ou uma stablecoin contra USD/EUR)
const BROKER_FEES: Record<string, { maker: number; taker: number }> = {
  'binance:spot': { maker: 0.1, taker: 0.1 },
  'binance:futures': { maker: 0.02, taker: 0.05 },
  coinbase: { maker: 0.4, taker: 0.6 },
  'coinbase:stable': { maker: 0, taker: 0.001 },
};
const STABLECOINS = ['USDT', 'USDC', 'DAI', 'PYUSD', 'EURC', 'USDS', 'FDUSD'];
const FIAT = ['USD', 'EUR'];

/** As comissões por omissão do mercado escolhido (a de taker nos dois lados: as ordens a mercado e os stops). */
export const brokerFees = (instrument: Market_Instrument | null): { key: string; maker: number; taker: number } | null => {
  if (!instrument) return null;
  const source = instrument.source.toLowerCase();
  let key: string;
  if (source === 'binance') key = instrument.type === 'spot' ? 'binance:spot' : 'binance:futures';
  else if (source === 'coinbase') {
    const base = (instrument.asset.ticker ?? '').toUpperCase();
    const quote = instrument.quote.toUpperCase();
    key = STABLECOINS.includes(base) && [...STABLECOINS, ...FIAT].includes(quote) ? 'coinbase:stable' : 'coinbase';
  } else return null;
  return { key, ...BROKER_FEES[key] };
};

const toNumber = (text: string) => Number(text.replace(',', '.'));
export const isNumber = (text: string, min = 0, max = Infinity) => {
  if (text.trim() === '') return false;
  const number = toNumber(text);
  return Number.isFinite(number) && number >= min && number <= max;
};
export const isInteger = (text: string, min: number, max: number) =>
  isNumber(text, min, max) && Number.isInteger(toNumber(text));
const optionalNumber = (text: string) => (text.trim() === '' ? 0 : toNumber(text));
const isClock = (text: string) => /^([01]\d|2[0-3]):[0-5]\d$/.test(text);

/** Uma regra de horário está bem: tem dias ou as duas horas. */
export const scheduleRuleOk = (rule: Schedule_Rule_Form) => {
  const hours = rule.from || rule.to;
  if (hours && (!isClock(rule.from) || !isClock(rule.to))) return false;
  return rule.days.length > 0 || Boolean(hours);
};

export const scheduleOk = (schedule: Schedule_Form | null) => !schedule || schedule.rules.every(scheduleRuleOk);

/** Um horário como vai no pedido (sem regras = nenhum). */
export const schedulePayload = (schedule: Schedule_Form | null): Schedule_Payload | null =>
  schedule?.rules.length
    ? {
        mode: schedule.mode,
        rules: schedule.rules.map((rule) => ({
          days: [...rule.days].sort(),
          ...(rule.from && rule.to ? { from: rule.from, to: rule.to } : {}),
        })),
      }
    : null;

export const scheduleForm = (schedule: Schedule_Payload | null | undefined): Schedule_Form | null =>
  schedule?.rules.length
    ? {
        mode: schedule.mode,
        rules: schedule.rules.map((rule) => newScheduleRule({ days: rule.days, from: rule.from ?? '', to: rule.to ?? '' })),
      }
    : null;

export const guardOk = (guard: Guard_Form) =>
  isNumber(guard.value, 0.01) &&
  (guard.event === 'lossStreak' || guard.windowCount.trim() === '' || isNumber(guard.windowCount, 0.01)) &&
  isNumber(guard.pauseCount, 0.01);

/**
 * O que está mal em cada opção ligada (a chave da tradução do erro). Uma opção
 * com erro não deixa simular.
 */
export const optionErrors = (options: Options_Form, instrument: Market_Instrument | null) => {
  const errors: Partial<Record<Option_Key, string>> = {};
  const on = (key: Option_Key) => options.enabled.includes(key) && optionAvailable(key, instrument);

  if (
    on('deposits') &&
    (!isNumber(options.depositAmount, 0.01) ||
      (options.depositIncreaseEvery !== '' && !isNumber(options.depositIncreaseAmount, 0)))
  ) {
    errors.deposits = 'trading.optError_deposit';
  }
  if (on('funding') && options.fundingMode === 'fixed' && !isNumber(options.fundingRatePct, -1, 1)) {
    errors.funding = 'trading.optError_funding';
  }
  if (on('funding') && options.fundingMode === 'historical' && instrument && instrument.type !== 'perpetual') {
    errors.funding = 'trading.optError_fundingPerpetual';
  }
  if (on('slippage') && !isNumber(options.slippagePct, 0, 5)) errors.slippage = 'trading.optError_slippage';
  if (
    on('orderSize') &&
    [options.quantityStep, options.minQuantity, options.minNotional].some((text) => text.trim() && !isNumber(text))
  ) {
    errors.orderSize = 'trading.optError_number';
  }
  if (on('outOfSample') && !isNumber(options.outOfSamplePct, 10, 90)) errors.outOfSample = 'trading.optError_sample';
  if (on('propFirm') && propFirmProblem(options)) errors.propFirm = 'trading.optError_propFirm';
  if (on('positions') && !isInteger(options.maxPositions, 1, 20)) errors.positions = 'trading.optError_positions';
  if (on('cooldown') && !isInteger(options.cooldownBars, 0, 1000)) errors.cooldown = 'trading.optError_cooldown';
  if (
    on('sizingRules') &&
    options.sizingRules.some(
      (rule) =>
        !isInteger(rule.count, 1, 50) ||
        (rule.action !== 'reset' && !isNumber(rule.value, 0.01)) ||
        (rule.trades.trim() !== '' && !isInteger(rule.trades, 0, 1000)),
    )
  ) {
    errors.sizingRules = 'trading.optError_rules';
  }
  if (on('schedule') && !options.blockedTimes.every(scheduleRuleOk)) errors.schedule = 'trading.optError_schedule';
  if (on('excluded') && options.excludedPeriods.some((period) => !period.from || !period.to || period.from > period.to)) {
    errors.excluded = 'trading.optError_excluded';
  }
  return errors;
};

// O desafio precisa de pelo menos uma regra, e cada valor no intervalo do backend
const propFirmProblem = (options: Options_Form) => {
  const optional = (text: string, min: number, max: number) => text.trim() === '' || isNumber(text, min, max);
  if (![options.propDailyLossPct, options.propMaxLossPct, options.propTargetPct].some((text) => text.trim())) return true;
  return (
    !optional(options.propDailyLossPct, 0.1, 50) ||
    !optional(options.propMaxLossPct, 0.1, 90) ||
    !optional(options.propTargetPct, 0.1, 1000) ||
    !(options.propMinDays.trim() === '' || isInteger(options.propMinDays, 0, 365)) ||
    !isInteger(options.propDays, 1, 365)
  );
};

const emptyAsNull = (text: string) => (text.trim() === '' ? null : toNumber(text));

/** O que é geral, como vai no pedido. As opções desligadas ficam de fora (o normal). */
export const optionsPayload = (
  options: Options_Form,
  instrument: Market_Instrument | null,
): Simulation_Options_Payload => {
  const on = (key: Option_Key) => options.enabled.includes(key) && optionAvailable(key, instrument);
  const futures = Boolean(instrument && instrument.type !== 'spot');
  const payload: Simulation_Options_Payload = { timezone: options.timezone };

  if (on('deposits')) {
    payload.depositEvery = options.depositEvery;
    payload.depositAmount = toNumber(options.depositAmount);
    payload.depositIncrease = options.depositIncreaseEvery
      ? { every: options.depositIncreaseEvery, amount: toNumber(options.depositIncreaseAmount || '0') }
      : null;
  }
  if (on('funding')) {
    payload.funding =
      options.fundingMode === 'fixed'
        ? { mode: 'fixed', ratePct: toNumber(options.fundingRatePct) }
        : { mode: 'historical' };
  }
  if (futures) {
    payload.marginMode = options.marginMode;
    payload.maintenanceMarginPct = optionalNumber(options.maintenancePct);
  }
  if (on('execution')) payload.executionPrice = options.executionPrice;
  if (on('slippage')) payload.slippagePct = toNumber(options.slippagePct);
  if (on('orderSize')) {
    payload.quantityStep = optionalNumber(options.quantityStep);
    payload.minQuantity = optionalNumber(options.minQuantity);
    payload.minNotional = optionalNumber(options.minNotional);
  }
  if (on('outOfSample')) payload.outOfSamplePct = toNumber(options.outOfSamplePct);
  if (on('propFirm')) {
    payload.propFirm = {
      dailyLossPct: emptyAsNull(options.propDailyLossPct),
      maxLossPct: emptyAsNull(options.propMaxLossPct),
      maxLossMode: options.propMaxLossMode,
      profitTargetPct: emptyAsNull(options.propTargetPct),
      minTradingDays: optionalNumber(options.propMinDays),
      days: toNumber(options.propDays),
    };
  }
  if (on('positions')) payload.maxPositions = toNumber(options.maxPositions);
  if (on('opposite')) payload.opposite = options.opposite;
  if (on('cooldown')) {
    payload.cooldownBars = toNumber(options.cooldownBars);
    payload.cooldownAfter = options.cooldownAfter;
  }
  if (on('sizingRules')) {
    payload.sizingRules = options.sizingRules.map((rule) => ({
      after: rule.after,
      count: toNumber(rule.count),
      action: rule.action,
      ...(rule.action !== 'reset' ? { value: toNumber(rule.value) } : {}),
      trades: optionalNumber(rule.trades),
    }));
  }
  if (on('schedule')) payload.blockedTimes = schedulePayload({ mode: 'except', rules: options.blockedTimes })?.rules ?? [];
  if (on('excluded')) {
    payload.excludedPeriods = options.excludedPeriods.map((period) => ({ from: period.from, to: period.to }));
  }
  payload.tradingGuards = options.guards.map((guard) => ({
    event: guard.event,
    value: toNumber(guard.value),
    window:
      guard.event !== 'lossStreak' && guard.windowCount.trim()
        ? { count: toNumber(guard.windowCount), unit: guard.windowUnit }
        : null,
    pause: { count: toNumber(guard.pauseCount), unit: guard.pauseUnit },
  }));
  return payload;
};

/** O que é geral numa simulação gravada: liga-se cada opção que tinha um valor diferente do normal. */
export const optionsFromStrategy = (strategy: Simulation_Run['strategy']): Options_Form => {
  const options = defaultOptions();
  const enable = (key: Option_Key) => options.enabled.push(key);

  if (strategy.timezone) options.timezone = strategy.timezone;
  if (strategy.depositEvery && strategy.depositAmount) {
    enable('deposits');
    options.depositEvery = strategy.depositEvery;
    options.depositAmount = String(strategy.depositAmount);
    if (strategy.depositIncrease?.amount) {
      options.depositIncreaseEvery = strategy.depositIncrease.every;
      options.depositIncreaseAmount = String(strategy.depositIncrease.amount);
    }
  }
  if (strategy.funding && strategy.funding.mode !== 'none') {
    enable('funding');
    options.fundingMode = strategy.funding.mode;
    if (strategy.funding.ratePct != null) options.fundingRatePct = String(strategy.funding.ratePct);
  }
  if (strategy.marginMode) options.marginMode = strategy.marginMode;
  if (strategy.maintenanceMarginPct != null) options.maintenancePct = String(strategy.maintenanceMarginPct);
  if (strategy.executionPrice && strategy.executionPrice !== 'open') {
    enable('execution');
    options.executionPrice = strategy.executionPrice;
  }
  if (strategy.slippagePct) {
    enable('slippage');
    options.slippagePct = String(strategy.slippagePct);
  }
  if (strategy.quantityStep || strategy.minQuantity || strategy.minNotional) {
    enable('orderSize');
    options.quantityStep = strategy.quantityStep ? String(strategy.quantityStep) : '';
    options.minQuantity = strategy.minQuantity ? String(strategy.minQuantity) : '';
    options.minNotional = strategy.minNotional ? String(strategy.minNotional) : '';
  }
  if (strategy.outOfSamplePct) {
    enable('outOfSample');
    options.outOfSamplePct = String(strategy.outOfSamplePct);
  }
  if (strategy.propFirm) {
    enable('propFirm');
    const firm = strategy.propFirm;
    const text = (number: number | null | undefined) => (number == null ? '' : String(number));
    options.propDailyLossPct = text(firm.dailyLossPct);
    options.propMaxLossPct = text(firm.maxLossPct);
    options.propMaxLossMode = firm.maxLossMode ?? 'static';
    options.propTargetPct = text(firm.profitTargetPct);
    options.propMinDays = text(firm.minTradingDays);
    options.propDays = String(firm.days ?? 30);
  }
  if (strategy.maxPositions && strategy.maxPositions > 1) {
    enable('positions');
    options.maxPositions = String(strategy.maxPositions);
  }
  if (strategy.opposite && strategy.opposite !== 'ignore') {
    enable('opposite');
    options.opposite = strategy.opposite;
  }
  if (strategy.cooldownBars) {
    enable('cooldown');
    options.cooldownBars = String(strategy.cooldownBars);
    options.cooldownAfter = strategy.cooldownAfter ?? 'any';
  }
  if (strategy.sizingRules?.length) {
    enable('sizingRules');
    options.sizingRules = strategy.sizingRules.map((rule) =>
      newSizingRule({
        after: rule.after,
        count: String(rule.count),
        action: rule.action,
        value: rule.value != null ? String(rule.value) : '',
        trades: rule.trades ? String(rule.trades) : '',
      }),
    );
  }
  if (strategy.blockedTimes?.length) {
    enable('schedule');
    options.blockedTimes = strategy.blockedTimes.map((rule) =>
      newScheduleRule({ days: rule.days, from: rule.from ?? '', to: rule.to ?? '' }),
    );
  }
  if (strategy.excludedPeriods?.length) {
    enable('excluded');
    options.excludedPeriods = strategy.excludedPeriods.map((period) => newExcludedPeriod(period));
  }
  options.guards = (strategy.tradingGuards ?? []).map((guard) =>
    newGuard({
      event: guard.event,
      value: String(guard.value),
      windowCount: guard.window ? String(guard.window.count) : '',
      windowUnit: guard.window?.unit ?? 'days',
      pauseCount: String(guard.pause.count),
      pauseUnit: guard.pause.unit,
    }),
  );
  return options;
};

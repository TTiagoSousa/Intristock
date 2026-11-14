import type { Operator } from '../../../../Hooks/Trading/useSimulation';
import { isBetween, isProfile, isProfilePrice, profileValuesOf } from './simulationForm';
import type { Condition_Form, Entry_Form, Indicator_Form, Value_Form } from './simulationForm';
import type { Preview_Candle, Preview_Model, Preview_Outcome } from './entryPreview';
import { computeProfile, rowVolumeAt } from './volumeProfile';
import type { Profile_Candle, Volume_Profile } from './volumeProfile';

/**
 * O esquema de uma entrada que usa o perfil de volume: uma sessão anterior com
 * o perfil dela (o histograma, o POC, o VAH e o VAL, calculados com as contas da
 * biblioteca sobre as velas inventadas), os níveis prolongados para a sessão em
 * curso e, se a entrada os usa, o POC e a área de valor em desenvolvimento, que
 * se vão construindo vela a vela. O sinal é a primeira vela em que as condições
 * da entrada se cumprem de facto nestas velas (as que o esquema não sabe
 * calcular, como uma média, contam como cumpridas); o stop e o take ficam onde a
 * entrada os põe (num nível do perfil, na mínima de N velas, numa %), e uma saída
 * com condição sai quando ela se cumpre. Tudo em % do preço de entrada.
 */

export interface Preview_Profile {
  // A primeira vela da sessão em curso (as de antes são a anterior)
  sessionStart: number;
  rows: { lo: number; hi: number; volume: number; inVa: boolean }[];
  levels: { poc: number; vah: number; val: number };
  // Os níveis da sessão anterior e os em desenvolvimento que a entrada usa
  used: Record<Level, boolean>;
  devUsed: Record<Level, boolean>;
  // Em cada vela da sessão em curso, o nível em desenvolvimento (null antes de haver velas dela)
  developing: Record<Level, (number | null)[]> | null;
}

type Level = 'poc' | 'vah' | 'val';
const LEVELS: Level[] = ['poc', 'vah', 'val'];

const PREV_BARS = 12;
const MAX_PRE = 10;
const MAX_POST = 24;
const AFTER_EXIT = 2;
// O tamanho típico de uma vela, em %
const UNIT = 0.5;

const toNumber = (text: string) => {
  const number = Number(text.replace(',', '.'));
  return text.trim() !== '' && Number.isFinite(number) ? number : null;
};
const positive = (text: string) => {
  const number = toNumber(text);
  return number != null && number > 0 ? number : null;
};

const randomFrom = (seed: number) => {
  let state = seed;
  return () => {
    state = (state * 16807) % 2147483647;
    return (state - 1) / 2147483646;
  };
};

const isUp = (operator: Operator) => operator === 'gt' || operator === 'gte' || operator === 'cross_above';

const profileIndicator = (value: Value_Form, indicators: Indicator_Form[]) =>
  value.kind === 'indicator'
    ? indicators.find((item) => item.id === value.indicatorId && isProfile(item.kind)) ?? null
    : null;

/** Se a entrada usa o perfil de volume (então o esquema é este). */
export const usesProfile = (entry: Entry_Form, indicators: Indicator_Form[]) => profileValuesOf(entry, indicators).length > 0;

// A primeira comparação (também dentro de um grupo) com o perfil de um dos lados
const primaryOf = (conditions: Condition_Form[], indicators: Indicator_Form[]): Condition_Form | null => {
  for (const condition of conditions) {
    if (condition.group) {
      const inner = primaryOf(condition.group, indicators);
      if (inner) return inner;
    } else if (profileIndicator(condition.left, indicators) || profileIndicator(condition.right, indicators)) {
      return condition;
    }
  }
  return null;
};

export const buildProfilePreview = (
  entry: Entry_Form,
  spot: boolean,
  indicators: Indicator_Form[],
  wanted: Preview_Outcome,
): Preview_Model => {
  const side: 1 | -1 = spot || entry.side === 'long' ? 1 : -1;
  const random = randomFrom(13 + wanted.length * 29);
  const values = profileValuesOf(entry, indicators);
  const indicator = profileIndicator(values[0], indicators)!;
  const rowCount = indicator.rowsLayout === 'rows' ? Math.min(48, Math.max(8, Number(indicator.rowSize) || 24)) : 24;
  const vaPct = Math.min(100, Math.max(1, Number(indicator.vaPct) || 70));

  // --- a sessão anterior: anda de lado, com mais volume no meio -----------------
  const candles: Profile_Candle[] = [];
  let price = 0;
  for (let bar = 0; bar < PREV_BARS; bar++) {
    const close = price + Math.sin(bar / 2.1) * UNIT * 0.9 + (random() - 0.5) * UNIT;
    candles.push({
      open: price,
      close,
      high: Math.max(price, close) + random() * UNIT * 0.45,
      low: Math.min(price, close) - random() * UNIT * 0.45,
      volume: 40 + 60 * random() + (bar >= 3 && bar <= 8 ? 60 : 0),
    });
    price = close;
  }
  const previous = computeProfile(candles, rowCount, vaPct)!;
  const sessionStart = PREV_BARS;

  // O perfil das velas da sessão em curso já fechadas antes da vela `decision`
  const developingCache = new Map<number, Volume_Profile | null>();
  const developingAt = (decision: number) => {
    if (!developingCache.has(decision)) {
      developingCache.set(decision, decision > sessionStart ? computeProfile(candles.slice(sessionStart, decision), rowCount, vaPct) : null);
    }
    return developingCache.get(decision)!;
  };

  // O valor de um lado na abertura da vela `decision` (só as velas antes dela contam); null = o esquema não o sabe
  const valueAt = (value: Value_Form, decision: number): number | null => {
    if (value.kind === 'number') return toNumber(value.value);
    if (value.kind === 'candle') {
      if (value.source === 'volume') return null;
      if (value.source === 'open_current') return candles[decision - 1]?.close ?? null;
      const candle = candles[decision - 1 - value.back];
      return candle ? candle[value.source] : null;
    }
    if (value.kind === 'window') {
      const last = decision - 1 - value.back;
      const period = Number(value.period) || 0;
      if (last - period + 1 < 0 || period < 1) return null;
      const span = candles.slice(last - period + 1, last + 1);
      if (value.windowKind === 'bullish') return span.filter((candle) => candle.close > candle.open).length;
      if (value.windowKind === 'bearish') return span.filter((candle) => candle.close < candle.open).length;
      const field = value.source === 'open_current' || value.source === 'volume' ? 'close' : value.source;
      const numbers = span.map((candle) => candle[field]);
      return value.windowKind === 'highest' ? Math.max(...numbers) : Math.min(...numbers);
    }
    if (!profileIndicator(value, indicators)) return null;
    const at = decision - value.back;
    if (at < sessionStart) return null;
    const close = candles[at - 1]?.close;
    if (value.profileSource === 'developing') {
      const profile = developingAt(at);
      if (!profile) return null;
      if (value.profileLevel === 'delta') return profile.delta;
      if (value.profileLevel === 'rowVolume') return close == null ? null : rowVolumeAt(profile, close);
      return profile[value.profileLevel];
    }
    // Só há uma sessão anterior no esquema: mais para trás, não se sabe
    if (value.profileSource === 'session' && Number(value.sessionsBack) > 1) return null;
    if (value.profileLevel === 'delta') return previous.delta;
    if (value.profileLevel === 'rowVolume') return close == null ? null : rowVolumeAt(previous, close);
    const level = previous[value.profileLevel];
    if (value.profileSource === 'naked') {
      // Depois de uma vela lhe tocar, o virgem seria o de uma sessão mais antiga
      const touched = candles.slice(sessionStart, at).some((candle) => candle.low <= level && candle.high >= level);
      return touched ? null : level;
    }
    return level;
  };

  const compare = (left: number, right: number, operator: Operator) =>
    operator === 'gt' || operator === 'cross_above'
      ? left > right
      : operator === 'gte'
        ? left >= right
        : operator === 'lt' || operator === 'cross_below'
          ? left < right
          : left <= right;

  // Uma condição na abertura de `decision` (as que o esquema não sabe calcular contam como cumpridas)
  const holds = (condition: Condition_Form, decision: number): boolean => {
    if (condition.group) {
      const results = condition.group.map((item) => holds(item, decision));
      return condition.groupMatch === 'any' ? results.some(Boolean) : results.every(Boolean);
    }
    const factor = 1 + (toNumber(condition.rightPct) ?? 0) / 100;
    const side = (value: Value_Form, at: number, right = false) => {
      const number = valueAt(value, at);
      return number == null ? null : right ? number * factor : number;
    };
    const left = side(condition.left, decision);
    const right = side(condition.right, decision, true);
    if (left == null || right == null) return true;
    if (isBetween(condition.operator)) {
      const other = side(condition.rightTo, decision, true);
      return other == null || (left >= Math.min(right, other) && left <= Math.max(right, other));
    }
    if (!compare(left, right, condition.operator)) return false;
    if (condition.operator === 'cross_above' || condition.operator === 'cross_below') {
      const before = side(condition.left, decision - 1);
      const beforeRight = side(condition.right, decision - 1, true);
      if (before == null || beforeRight == null) return true;
      return condition.operator === 'cross_above' ? before <= beforeRight : before >= beforeRight;
    }
    return true;
  };
  const all = (conditions: Condition_Form[], match: string, decision: number) =>
    conditions.length === 0 ||
    (match === 'any' ? conditions.some((item) => holds(item, decision)) : conditions.every((item) => holds(item, decision)));

  // --- a sessão em curso até ao sinal ------------------------------------------
  // O preço vem do outro lado do nível da condição principal e atravessa-o
  const primary = primaryOf(entry.conditions, indicators);
  let target = previous.poc;
  let direction = 1;
  if (primary) {
    const onLeft = !!profileIndicator(primary.left, indicators);
    const value = onLeft ? primary.left : primary.right;
    if (isProfilePrice(value.profileLevel)) target = previous[value.profileLevel as Level];
    if (isBetween(primary.operator)) {
      // Entre dois níveis: de fora (por baixo) para dentro
      const other = valueAt(primary.rightTo, sessionStart + 1);
      target = Math.min(target, other ?? target);
      direction = 1;
    } else {
      direction = isUp(primary.operator) !== onLeft ? 1 : -1;
    }
  }
  const startPrice = target - direction * UNIT * 2.2;
  price = startPrice;
  for (let bar = 0; bar < MAX_PRE; bar++) {
    const goal = bar < 6 ? startPrice + ((target + direction * UNIT * 0.5 - startPrice) * (bar + 1)) / 6 : target + direction * UNIT * (0.6 + 0.2 * Math.sin(bar));
    const close = goal + (random() - 0.5) * UNIT * 0.35;
    candles.push({
      open: price,
      close,
      high: Math.max(price, close) + random() * UNIT * 0.3,
      low: Math.min(price, close) - random() * UNIT * 0.3,
      volume: 50 + 50 * random(),
    });
    price = close;
  }
  // O sinal: a primeira vela cuja abertura seguinte vê as condições cumpridas
  let signal = -1;
  for (let bar = sessionStart; bar < candles.length - 1 && signal < 0; bar++) {
    if (all(entry.conditions, entry.match, bar + 1)) signal = bar;
  }
  // Sem nenhuma (condições que estas velas não cumprem), mostra-se onde o preço atravessa
  if (signal < 0) signal = sessionStart + 5;
  candles.length = signal + 1;

  // --- a entrada ---------------------------------------------------------------
  let entryIndex = signal + 1;
  let entryPrice = candles[signal].close;
  let order: Preview_Model['order'] = null;
  const orderLevel = entry.price.kind !== 'market' ? valueAt(entry.price, signal + 1) : null;
  if (orderLevel != null) {
    // A um preço: a ordem espera até o preço lá chegar (na segunda vela, para se ver)
    const waits = Math.max(1, Math.min(Number(entry.orderBars) || 1, 4));
    const fill = Math.min(2, waits);
    price = candles[signal].close;
    for (let bar = 1; bar <= fill; bar++) {
      const close = bar === fill ? orderLevel + (price > orderLevel ? UNIT * 0.15 : -UNIT * 0.15) : price + (orderLevel - price) * 0.5;
      candles.push({
        open: price,
        close,
        high: Math.max(price, close, bar === fill ? orderLevel : -Infinity) + random() * UNIT * 0.2,
        low: Math.min(price, close, bar === fill ? orderLevel : Infinity) - random() * UNIT * 0.2,
        volume: 60,
      });
      price = close;
    }
    entryIndex = signal + fill;
    entryPrice = orderLevel;
    order = { level: 0, from: signal + 1, to: signal + waits };
  }
  const favour = (value: number) => (value - entryPrice) * side;
  const fromFavour = (value: number) => entryPrice + value * side;

  // O stop: onde a entrada o põe; sem saber (um nível que o esquema não calcula), a 2%
  const buffer = toNumber(entry.stopBufferPct) ?? 0;
  let stop: number | null = null;
  if (entry.stopMode === 'pct') {
    const pct = positive(entry.stopLossPct);
    stop = pct != null ? -pct : null;
  } else {
    let level: number | null;
    if (entry.stopMode === 'swing') {
      const bars = Math.max(1, Number(entry.stopBars) || 1);
      const before = candles.slice(Math.max(0, entryIndex - bars), entryIndex);
      level = before.length ? (side === 1 ? Math.min(...before.map((c) => c.low)) : Math.max(...before.map((c) => c.high))) : null;
    } else {
      level = valueAt(entry.stopLevel, entryIndex);
    }
    stop = level == null ? -2 : favour(level) - buffer;
    if (stop >= -0.05) stop = -2;
  }
  // O take: em %, em R (sobre a distância ao stop) ou uma saída num nível sem condições
  const takeR = entry.takeMode === 'r' ? positive(entry.takeR) : null;
  let take = entry.takeMode === 'r' ? (takeR && stop ? takeR * -stop : null) : positive(entry.takeProfitPct);
  let takeOutcome: Preview_Outcome = 'take_profit';
  for (const exit of entry.exits) {
    if (exit.conditions.length || exit.price.kind === 'market') continue;
    const level = valueAt(exit.price, entryIndex);
    const at = level == null ? null : favour(level);
    if (at != null && at > 0.05 && (take == null || at < take)) {
      take = at;
      takeOutcome = 'signal';
    }
  }
  const trail = positive(entry.trailingPct);
  const breakEven = positive(entry.breakEvenPct);
  const maxBars = positive(entry.maxBars);
  const conditionExits = entry.exits.filter((exit) => exit.conditions.length);
  const partials = entry.partials
    .map((part) => {
      const value = positive(part.value);
      const level = value && (part.mode === 'r' ? (stop ? value * -stop : null) : value);
      return { level, closePct: positive(part.closePct) ?? 0, move: part.moveStop, index: null as number | null };
    })
    .filter((part): part is { level: number; closePct: number; move: boolean; index: number | null } =>
      part.level != null && (take == null || part.level < take),
    );

  // --- depois da entrada: o percurso até à saída pedida -------------------------
  const start = favour(candles[candles.length - 1].close);
  const risk = stop ? -stop : 2;
  const ramp = (k: number, from: number, to: number, a: number, b: number) =>
    k <= a ? from : k >= b ? to : from + ((to - from) * (k - a)) / (b - a);
  const shape = (k: number) => {
    switch (wanted) {
      case 'take_profit':
        return ramp(k, start, (take ?? risk * 2) * 1.15, 0, 11);
      case 'stop_loss':
        return k <= 3 ? ramp(k, start, risk * 0.25, 0, 3) : ramp(k, risk * 0.25, -risk * 1.25, 3, 10);
      case 'signal':
        // A favor primeiro e depois volta para trás (sem chegar ao stop): é aí que as saídas com condição costumam cumprir-se
        return k <= 4 ? ramp(k, start, risk * 0.5, 0, 4) : ramp(k, risk * 0.5, -risk * 0.55, 4, 12);
      case 'trailing_stop': {
        const peak = Math.max((trail ?? risk) * 1.8, risk);
        return k <= 9 ? ramp(k, start, peak, 0, 9) : ramp(k, peak, peak - (trail ?? risk) * 1.5, 9, 13);
      }
      case 'break_even': {
        const peak = (breakEven ?? risk) * 1.3;
        return k <= 7 ? ramp(k, start, peak, 0, 7) : ramp(k, peak, -risk * 0.4, 7, 12);
      }
      default:
        return start + risk * 0.2 * Math.sin(k / 2);
    }
  };

  const stops: Preview_Model['stops'] = [];
  let exit: Preview_Model['exit'] | null = null;
  let best = 0;
  let moved = false;
  let last = start;
  const firstBar = order ? entryIndex + 1 : entryIndex;
  for (let k = 1; k <= MAX_POST && !exit; k++) {
    const index = firstBar + k - 1;
    // Na abertura: a saída por tempo e as saídas com condição (vistas com as velas fechadas)
    if (wanted === 'time' && k > Math.min(maxBars ?? 8, MAX_POST)) {
      exit = { index, price: fromFavour(last), outcome: 'time', at: 'open', pnl: last };
      break;
    }
    if (index > entryIndex && conditionExits.some((item) => all(item.conditions, item.match, index))) {
      exit = { index, price: fromFavour(last), outcome: 'signal', at: 'open', pnl: last };
      break;
    }
    if (wanted === 'signal' && k > 14) {
      exit = { index, price: fromFavour(last), outcome: 'signal', at: 'open', pnl: last };
      break;
    }

    const close = shape(k) + (random() - 0.5) * UNIT * 0.4;
    const high = Math.max(last, close) + random() * UNIT * 0.3;
    const low = Math.min(last, close) - random() * UNIT * 0.3;
    const levels: { level: number; outcome: Preview_Outcome }[] = [];
    if (stop) levels.push({ level: stop, outcome: 'stop_loss' });
    if (trail) levels.push({ level: best - trail, outcome: 'trailing_stop' });
    if ((breakEven && best >= breakEven) || moved) levels.push({ level: 0, outcome: 'break_even' });
    const binding = levels.reduce<(typeof levels)[number] | null>((top, item) => (!top || item.level > top.level ? item : top), null);
    if (binding) stops.push({ index, level: binding.level * side });

    const candle = {
      open: fromFavour(last),
      close: fromFavour(close),
      high: side === 1 ? fromFavour(high) : fromFavour(low),
      low: side === 1 ? fromFavour(low) : fromFavour(high),
      volume: 60,
    };
    candles.push(candle);
    if (binding && low <= binding.level) {
      const at = Math.min(last, binding.level);
      exit = { index, price: fromFavour(at), outcome: binding.outcome, at: 'level', pnl: at };
      break;
    }
    for (const part of partials) {
      if (part.index == null && high >= part.level) {
        part.index = index;
        moved = moved || part.move;
      }
    }
    if (take != null && high >= take) {
      exit = { index, price: fromFavour(take), outcome: takeOutcome, at: 'level', pnl: take };
      break;
    }
    best = Math.max(best, high);
    last = close;
  }
  const ended = exit ?? { index: candles.length - 1, price: fromFavour(last), outcome: wanted, at: 'open' as const, pnl: last };

  let after = candles[candles.length - 1].close;
  for (let bar = 0; bar < AFTER_EXIT; bar++) {
    const close = after + (random() - 0.5) * UNIT * 0.6;
    candles.push({ open: after, close, high: Math.max(after, close) + UNIT * 0.15, low: Math.min(after, close) - UNIT * 0.15, volume: 50 });
    after = close;
  }

  // --- os níveis em desenvolvimento e a passagem a % do preço de entrada -------
  const used = { poc: false, vah: false, val: false };
  const devUsed = { poc: false, vah: false, val: false };
  for (const value of values) {
    if (!isProfilePrice(value.profileLevel)) continue;
    (value.profileSource === 'developing' ? devUsed : used)[value.profileLevel as Level] = true;
  }
  const shift = (value: number) => value - entryPrice;
  const anyDev = LEVELS.some((level) => devUsed[level]);
  const developing = anyDev
    ? (Object.fromEntries(
        LEVELS.map((level) => [
          level,
          candles.map((_, index) => {
            const profile = index > sessionStart ? developingAt(index) : null;
            return profile ? shift(profile[level]) : null;
          }),
        ]),
      ) as Record<Level, (number | null)[]>)
    : null;
  // Sem nenhum nível da anterior usado (só o delta, por exemplo), mostra-se o POC
  if (!LEVELS.some((level) => used[level]) && !anyDev) used.poc = true;

  const shown: Preview_Candle[] = candles.map((candle, index) => ({
    open: shift(candle.open),
    close: shift(candle.close),
    high: shift(candle.high),
    low: shift(candle.low),
    faded: index < sessionStart || index > ended.index,
  }));

  return {
    side,
    candles: shown,
    signal,
    entry: { index: entryIndex, price: 0 },
    order,
    exit: { ...ended, price: shift(ended.price) },
    take: take != null ? take * side : null,
    stops,
    right: null,
    left: null,
    rsi: null,
    partials: partials.map((part) => ({ level: part.level * side, closePct: part.closePct, index: part.index })),
    profile: {
      sessionStart,
      rows: previous.rows.map((row, index) => ({
        lo: shift(row.lo),
        hi: shift(row.hi),
        volume: row.volume,
        inVa: index >= previous.vaLow && index <= previous.vaHigh,
      })),
      levels: { poc: shift(previous.poc), vah: shift(previous.vah), val: shift(previous.val) },
      used,
      devUsed,
      developing,
    },
  };
};

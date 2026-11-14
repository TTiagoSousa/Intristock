import type { Operator } from '../../../../Hooks/Trading/useSimulation';
import { isBetween, isPriceIndicator } from './simulationForm';
import type { Entry_Form, Indicator_Form, Value_Form } from './simulationForm';
import { buildProfilePreview, usesProfile } from './profilePreview';
import type { Preview_Profile } from './profilePreview';

/**
 * O esquema de uma entrada: velas inventadas que mostram a lógica dela — o
 * sinal, a entrada (ao mercado ou a ordem a um preço), o stop, o take profit,
 * o trailing, o break-even, a saída por tempo ou com condição. Não são preços
 * reais: o percurso é desenhado para chegar à saída escolhida, e a saída que se
 * mostra é a que de facto acontece nesse percurso com as regras da entrada
 * (o stop ganha ao take na mesma vela, como no motor).
 *
 * Tudo em % do preço de entrada (0 = entrada). Depois da entrada trabalha-se
 * "a favor" (positivo = ganho) e passa-se ao preço com a direção.
 */

export type Preview_Outcome = 'take_profit' | 'stop_loss' | 'trailing_stop' | 'break_even' | 'time' | 'signal';

export interface Preview_Candle {
  open: number;
  high: number;
  low: number;
  close: number;
  // Antes do sinal e depois da saída ficam mais apagadas
  faded: boolean;
}

export interface Preview_Model {
  side: 1 | -1;
  candles: Preview_Candle[];
  signal: number;
  entry: { index: number; price: number };
  // A ordem a um preço: o nível e as velas em que espera (até encher)
  order: { level: number; from: number; to: number } | null;
  // 'open': sai na abertura da vela (por tempo, condição); 'level': durante a vela
  exit: { index: number; price: number; outcome: Preview_Outcome; at: 'open' | 'level'; pnl: number };
  take: number | null;
  // O stop em cada vela desde a entrada (sobe com o trailing e o break-even)
  stops: { index: number; level: number }[];
  // A linha do lado direito da condição (e a do esquerdo, se for um indicador)
  right: number[] | null;
  left: number[] | null;
  // A primeira condição com um RSI à esquerda, num painel dele (de 0 a 100)
  rsi: Preview_Rsi | null;
  // As saídas parciais: o nível, a % da posição e a vela em que aconteceu (null se não chegou)
  partials: { level: number; closePct: number; index: number | null }[];
  // Com o perfil de volume: a sessão anterior com o perfil dela e os níveis (profilePreview)
  profile?: Preview_Profile | null;
}

export interface Preview_Rsi {
  // A posição da condição na entrada, para o ecrã ir buscar os nomes
  condition: number;
  left: number[];
  right: number[];
  // O outro limite do "entre"
  rightTo: number[] | null;
}

const PRE_BARS = 10;
const AFTER_EXIT = 2;
const MAX_POST = 30;

const toNumber = (text: string) => {
  const number = Number(text.replace(',', '.'));
  return text.trim() !== '' && Number.isFinite(number) && number > 0 ? number : null;
};

// O stop do esquema: a % escrita; na mínima/máxima ou num nível não há uma % fixa e
// desenha-se a 2% (o esquema não tem preços reais)
const NOMINAL_STOP = 2;
const stopOf = (entry: Entry_Form) => (entry.stopMode === 'pct' ? toNumber(entry.stopLossPct) : NOMINAL_STOP);
// O take em R é R vezes a distância ao stop
const takeOf = (entry: Entry_Form) => {
  if (entry.takeMode !== 'r') return toNumber(entry.takeProfitPct);
  const r = toNumber(entry.takeR);
  const stop = stopOf(entry);
  return r && stop ? r * stop : null;
};

// Sempre os mesmos números "ao acaso", para o desenho não mudar a cada render
const randomFrom = (seed: number) => {
  let state = seed;
  return () => {
    state = (state * 16807) % 2147483647;
    return (state - 1) / 2147483646;
  };
};

const isUp = (operator: Operator) => operator === 'gt' || operator === 'gte' || operator === 'cross_above';

// Um valor que se desenha como uma linha de preço: um indicador de preço ou um número
const priceLike = (value: Value_Form, indicators: Indicator_Form[]) => {
  if (value.kind === 'number') return true;
  if (value.kind !== 'indicator') return false;
  const indicator = indicators.find((item) => item.id === value.indicatorId);
  return !!indicator && isPriceIndicator(indicator.kind) && indicator.field !== 'volume';
};

const isRsi = (value: Value_Form, indicators: Indicator_Form[]) =>
  value.kind === 'indicator' && indicators.some((item) => item.id === value.indicatorId && item.kind === 'rsi');

const clampRsi = (value: number) => Math.min(97, Math.max(3, value));

// Um lado da condição do RSI: um número fica parado; outra linha (a média, outro
// RSI) ondula à volta de `around`
const boundLine = (value: Value_Form, around: number, bars: number) => {
  const number = Number(value.value.replace(',', '.'));
  return Array.from({ length: bars }, (_, bar) =>
    value.kind === 'number' && Number.isFinite(number) ? clampRsi(number) : around + 3 * Math.sin(bar / 2.5),
  );
};

/**
 * O RSI até ao sinal, desenhado para a condição se cumprir só na vela do sinal:
 * abaixo e a subir num "acima de", ao contrário num "abaixo de", e de fora para
 * dentro num "entre" (por baixo, se houver espaço, senão por cima).
 */
const rsiBeforeSignal = (operator: Operator, right: number[], rightTo: number[] | null) => {
  const left: number[] = [];
  if (operator === 'between' && rightTo) {
    const low = (bar: number) => Math.min(right[bar], rightTo[bar]);
    const high = (bar: number) => Math.max(right[bar], rightTo[bar]);
    const fromBelow = low(0) >= 15;
    for (let bar = 0; bar <= PRE_BARS; bar++) {
      const inside = low(bar) + (high(bar) - low(bar)) * (fromBelow ? 0.3 : 0.7);
      const outside = fromBelow ? low(bar) - 14 + (12 * bar) / PRE_BARS : high(bar) + 14 - (12 * bar) / PRE_BARS;
      left.push(clampRsi(bar === PRE_BARS ? inside : outside));
    }
    return { left, direction: fromBelow ? 1 : -1 };
  }
  const direction = isUp(operator) ? 1 : -1;
  for (let bar = 0; bar <= PRE_BARS; bar++) {
    const gap = bar === PRE_BARS ? 5 : -14 + (11 * bar) / (PRE_BARS - 1);
    left.push(clampRsi(right[bar] + direction * gap));
  }
  return { left, direction };
};

/** As saídas que esta entrada tem, pela ordem em que se oferecem no esquema. */
export const previewOutcomes = (entry: Entry_Form): Preview_Outcome[] => {
  const take = takeOf(entry);
  const breakEven = toNumber(entry.breakEvenPct);
  const outcomes: Preview_Outcome[] = [];
  if (take) outcomes.push('take_profit');
  if (stopOf(entry)) outcomes.push('stop_loss');
  if (toNumber(entry.trailingPct)) outcomes.push('trailing_stop');
  if (breakEven && (!take || breakEven < take)) outcomes.push('break_even');
  if (toNumber(entry.maxBars)) outcomes.push('time');
  if (entry.exits.length) outcomes.push('signal');
  return outcomes;
};

export const buildPreview = (
  entry: Entry_Form,
  spot: boolean,
  indicators: Indicator_Form[],
  wanted: Preview_Outcome,
): Preview_Model => {
  // Com o perfil de volume, o esquema é outro: com a sessão anterior e o perfil dela
  if (usesProfile(entry, indicators)) return buildProfilePreview(entry, spot, indicators, wanted);
  const side: 1 | -1 = spot || entry.side === 'long' ? 1 : -1;
  const random = randomFrom(7 + wanted.length * 31);

  const stopPct = stopOf(entry);
  const takePct = takeOf(entry);
  const trailPct = toNumber(entry.trailingPct);
  const breakEvenPct = toNumber(entry.breakEvenPct);
  const maxBars = toNumber(entry.maxBars);
  // O tamanho dos movimentos e do "ruído" acompanha os valores da entrada
  const scale = Math.min(...[stopPct, takePct, trailPct, breakEvenPct].filter((pct): pct is number => pct != null), 4);
  const noise = scale * 0.12;

  // --- antes da entrada: o sinal ---------------------------------------------
  const condition = entry.conditions[0];
  const drawLines =
    !!condition &&
    !condition.group &&
    condition.operator !== 'between' &&
    priceLike(condition.right, indicators) &&
    ((condition.left.kind === 'candle' && condition.left.source !== 'volume') || priceLike(condition.left, indicators));
  // O RSI: a primeira condição com ele à esquerda. As velas acompanham-no quando
  // a primeira condição não desenha linhas de preço (sobem com ele a subir)
  const rsiIndex = entry.conditions.findIndex((item) => !item.group && isRsi(item.left, indicators));
  const rsiCondition = rsiIndex >= 0 ? entry.conditions[rsiIndex] : null;
  const rsiBars = PRE_BARS + 1;
  const rsiRight = rsiCondition ? boundLine(rsiCondition.right, isBetween(rsiCondition.operator) ? 32 : 50, rsiBars) : [];
  const rsiRightTo = rsiCondition && isBetween(rsiCondition.operator) ? boundLine(rsiCondition.rightTo, 68, rsiBars) : null;
  const rsiStart = rsiCondition ? rsiBeforeSignal(rsiCondition.operator, rsiRight, rsiRightTo) : null;
  const direction = rsiStart && !drawLines ? rsiStart.direction : condition && !isUp(condition.operator) ? -1 : 1;

  // Ao mercado entra na abertura seguinte (= fecho do sinal); a um preço, o
  // preço ainda está longe do nível: acima numa compra em recuo, abaixo num
  // rompimento (a máxima numa compra, a mínima numa venda)
  const atPrice = entry.price.kind !== 'market';
  const breakout =
    atPrice &&
    entry.price.kind === 'candle' &&
    ((side === 1 && entry.price.source === 'high') || (side === -1 && entry.price.source === 'low'));
  const offset = atPrice ? (breakout ? -side * scale * 0.3 : side * scale * 0.4) : 0;

  const reference = (bar: number) =>
    condition?.right.kind === 'number' ? direction * -0.4 + offset : direction * (-0.9 + 0.05 * bar) + offset;
  const candles: Preview_Candle[] = [];
  const closes: number[] = [];
  for (let bar = 0; bar <= PRE_BARS; bar++) {
    const close = bar === PRE_BARS ? offset : reference(bar) - direction * (0.45 + 0.35 * random()) * (scale / 4 + 0.5);
    const open = bar === 0 ? close - direction * 0.1 : closes[bar - 1];
    closes.push(close);
    candles.push({
      open,
      close,
      high: Math.max(open, close) + noise * random(),
      low: Math.min(open, close) - noise * random(),
      faded: bar < PRE_BARS,
    });
  }

  // --- a entrada ---------------------------------------------------------------
  // Em "a favor" a partir daqui: u = preço × direção
  const toPrice = (favour: number) => favour * side;
  let entryIndex = PRE_BARS + 1;
  let order: Preview_Model['order'] = null;
  let last: number; // o último fecho, a favor

  if (!atPrice) {
    last = 0;
  } else {
    const waits = Math.max(1, Math.min(Number(entry.orderBars) || 1, 6));
    // Com mais de uma vela de espera, enche na segunda: vê-se que esperou
    const fillAt = PRE_BARS + Math.min(2, waits);
    let price = offset;
    for (let bar = PRE_BARS + 1; bar < fillAt; bar++) {
      const close = price + (breakout ? -side : side) * noise * 0.5;
      candles.push({
        open: price,
        close,
        high: Math.max(price, close) + noise * 0.4,
        low: Math.min(price, close) - noise * 0.4,
        faded: false,
      });
      price = close;
    }
    // A vela que chega ao nível: em recuo, a sombra toca-o e volta; em rompimento, passa-o
    const close = toPrice(breakout ? scale * 0.15 : scale * 0.08);
    candles.push({
      open: price,
      close,
      high: breakout ? Math.max(price, close, toPrice(scale * 0.2)) : Math.max(price, close, 0),
      low: breakout ? Math.min(price, close, toPrice(scale * 0.2)) : Math.min(price, close, 0),
      faded: false,
    });
    entryIndex = fillAt;
    order = { level: 0, from: PRE_BARS + 1, to: Math.min(PRE_BARS + waits, fillAt) };
    last = close * side;
  }

  // --- depois da entrada: o percurso até à saída pedida -----------------------
  // A forma (a favor) em cada vela k = 1, 2, …; o ruído vem por cima
  const peakFor = (target: number) => (takePct ? Math.min(target, takePct * 0.85) : target);
  const shape = (k: number): number => {
    const ramp = (from: number, to: number, start: number, end: number) =>
      k <= start ? from : k >= end ? to : from + ((to - from) * (k - start)) / (end - start);
    switch (wanted) {
      case 'take_profit':
        return ramp(last, (takePct ?? scale) * 1.15, 0, 14);
      case 'stop_loss':
        return k <= 3 ? ramp(last, scale * 0.3, 0, 3) : ramp(scale * 0.3, -(stopPct ?? scale) * 1.2, 3, 11);
      case 'trailing_stop': {
        const trail = trailPct ?? scale;
        const peak = peakFor(Math.max(trail * 1.8, scale));
        return k <= 9 ? ramp(last, peak, 0, 9) : ramp(peak, peak - trail * 1.5, 9, 13);
      }
      case 'break_even': {
        const peak = peakFor((breakEvenPct ?? scale) * 1.3);
        return k <= 7 ? ramp(last, peak, 0, 7) : ramp(peak, -scale * 0.4, 7, 12);
      }
      default:
        // Por tempo e com condição: anda de lado, sem chegar aos stops
        return last + scale * 0.25 * Math.sin(k / 2);
    }
  };

  // A saída por tempo é N velas depois de entrar; com condição, ao fim de 8
  const forcedExit = wanted === 'time' ? Math.min(maxBars ?? 8, MAX_POST) : wanted === 'signal' ? 8 : null;
  const stops: Preview_Model['stops'] = [];
  // O melhor preço desde a entrada (a favor), para o trailing e o break-even;
  // começa no preço de entrada para o stop começar no valor escrito
  let best = 0;
  let exit: Preview_Model['exit'] | null = null;
  let previous = last;
  // Na vela da ordem, o stop já conta a partir do nível
  const startBar = atPrice ? entryIndex + 1 : entryIndex;

  // As saídas parciais a favor (em % ou R), antes do take; a que passa o stop
  // para a entrada muda o stop a partir da vela seguinte
  const partials = entry.partials
    .map((part) => {
      const value = toNumber(part.value);
      const level = value && (part.mode === 'r' ? (stopPct ? value * stopPct : null) : value);
      return { level, closePct: toNumber(part.closePct) ?? 0, move: part.moveStop, index: null as number | null };
    })
    .filter((part): part is { level: number; closePct: number; move: boolean; index: number | null } =>
      part.level != null && (!takePct || part.level < takePct),
    );
  let moved = false;

  for (let k = 1; k <= MAX_POST && !exit; k++) {
    const index = startBar + k - 1;
    if (forcedExit != null && k > forcedExit) {
      exit = { index, price: toPrice(previous), outcome: wanted, at: 'open', pnl: previous };
      break;
    }
    const target = shape(k);
    const close = target + (random() - 0.5) * noise * 1.2;
    const open = previous;
    const high = Math.max(open, close) + noise * random() * 0.8;
    const low = Math.min(open, close) - noise * random() * 0.8;

    // O stop desta vela: o mais alto (a favor) entre o fixo, o trailing e o break-even
    const levels: { level: number; outcome: Preview_Outcome }[] = [];
    if (stopPct) levels.push({ level: -stopPct, outcome: 'stop_loss' });
    if (trailPct) levels.push({ level: best - trailPct, outcome: 'trailing_stop' });
    if ((breakEvenPct && best >= breakEvenPct) || moved) levels.push({ level: 0, outcome: 'break_even' });
    const binding = levels.reduce<(typeof levels)[number] | null>(
      (top, item) => (!top || item.level > top.level ? item : top),
      null,
    );
    if (binding) stops.push({ index, level: toPrice(binding.level) });

    if (binding && low <= binding.level) {
      // Abriu já abaixo (salto): sai na abertura
      const price = Math.min(open, binding.level);
      candles.push({ open: toPrice(open), close: toPrice(close), ...extremes(high, low, side), faded: false });
      exit = { index, price: toPrice(price), outcome: binding.outcome, at: 'level', pnl: price };
      break;
    }
    for (const part of partials) {
      if (part.index == null && high >= part.level) {
        part.index = index;
        moved = moved || part.move;
      }
    }
    if (takePct && high >= takePct) {
      candles.push({ open: toPrice(open), close: toPrice(close), ...extremes(high, low, side), faded: false });
      exit = { index, price: toPrice(takePct), outcome: 'take_profit', at: 'level', pnl: takePct };
      break;
    }

    candles.push({ open: toPrice(open), close: toPrice(close), ...extremes(high, low, side), faded: false });
    best = Math.max(best, high);
    previous = close;
  }

  // Sem saída (não deve acontecer: cada entrada tem como fechar), fecha no fim
  if (!exit) {
    exit = { index: candles.length - 1, price: toPrice(previous), outcome: wanted, at: 'open', pnl: previous };
  }

  // Duas velas depois da saída, apagadas
  let after = candles[candles.length - 1].close;
  for (let bar = 0; bar < AFTER_EXIT; bar++) {
    const close = after + (random() - 0.5) * noise * 2;
    candles.push({
      open: after,
      close,
      high: Math.max(after, close) + noise * 0.5,
      low: Math.min(after, close) - noise * 0.5,
      faded: true,
    });
    after = close;
  }

  // As linhas da condição, ao longo de todas as velas
  const right = drawLines ? candles.map((_, bar) => reference(bar)) : null;
  const left =
    drawLines && condition.left.kind === 'indicator'
      ? candles.map((candle, bar) => 0.65 * candle.close + 0.35 * reference(bar))
      : null;

  // Depois do sinal o RSI segue o preço (sobe com ele, volta devagar aos 50); um
  // número fica parado e outra linha vai atrás do RSI, como uma média
  let rsi: Preview_Rsi | null = null;
  if (rsiCondition && rsiStart) {
    const rsiLeft = [...rsiStart.left];
    const follow = (line: number[]) => {
      const out = [...line];
      for (let bar = out.length; bar < candles.length; bar++) out.push(out[bar - 1]);
      return out;
    };
    const right = rsiCondition.right.kind === 'number' ? follow(rsiRight) : [...rsiRight];
    const rightTo = rsiRightTo && (rsiCondition.rightTo.kind === 'number' ? follow(rsiRightTo) : [...rsiRightTo]);
    for (let bar = rsiLeft.length; bar < candles.length; bar++) {
      const previous = rsiLeft[bar - 1];
      const move = ((candles[bar].close - candles[bar - 1].close) / scale) * 22;
      rsiLeft.push(clampRsi(previous + move + (50 - previous) * 0.06));
      if (right.length < candles.length) right.push(right[bar - 1] + 0.3 * (rsiLeft[bar] - right[bar - 1]));
      if (rightTo && rightTo.length < candles.length) rightTo.push(rightTo[bar - 1] + 0.3 * (rsiLeft[bar] - rightTo[bar - 1]));
    }
    rsi = { condition: rsiIndex, left: rsiLeft, right, rightTo };
  }

  return {
    side,
    candles,
    signal: PRE_BARS,
    entry: { index: entryIndex, price: 0 },
    order,
    exit,
    take: takePct ? toPrice(takePct) : null,
    stops,
    right,
    left,
    rsi,
    partials: partials.map((part) => ({ level: toPrice(part.level), closePct: part.closePct, index: part.index })),
  };
};

// A máxima e a mínima de uma vela "a favor", passadas a preço (numa venda trocam)
const extremes = (high: number, low: number, side: 1 | -1) =>
  side === 1 ? { high, low } : { high: -low, low: -high };

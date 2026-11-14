import type { TFunction } from 'i18next';
import { contextHasScope, contextIsPct, hasShift, hasSmoothing, isBetween, isCountKind, isProfile, isRangeLevel } from './simulationForm';
import type { Condition_Form, Entry_Form, Indicator_Form, Value_Form, Value_Line } from './simulationForm';

/**
 * Como se escreve um indicador ou um valor em texto corrido (nos resumos dos
 * cartões fechados e no que fica à vista de cada valor).
 */

// O nome automático, tirado das definições: "MM21", "MME50 +3", "RSI14", "MM20 Volume · 1 dia";
// no perfil de volume, como o título do indicador na biblioteca: "SVP Cada 24 70%", "SVP Mercado 24 70% · NYSE"
export const autoIndicatorName = (indicator: Indicator_Form, t: TFunction) => {
  if (isProfile(indicator.kind)) {
    // O título do indicador na biblioteca: "SVP HD Cada 24 Alta/Baixa 70"
    return [
      t('trading.kindShort_svp'),
      t(`trading.profileSessionShort_${indicator.session}`),
      indicator.rowSize,
      t(`trading.profileVolume_${indicator.volume}`),
      indicator.vaPct,
    ].join(' ');
  }
  const parts = [`${t(`trading.kindShort_${indicator.kind}`)}${indicator.period}`];
  if (indicator.field !== 'close') parts[0] += ` ${t(`trading.field_${indicator.field}`)}`;
  if (hasShift(indicator.kind) && Number(indicator.shift) > 0) parts[0] += ` +${Number(indicator.shift)}`;
  if (indicator.timeframe) parts.push(t(`trading.tf_${indicator.timeframe}`));
  return parts.join(' · ');
};

// O nome que o utilizador deu ou, sem nenhum, o automático
export const indicatorLabel = (indicator: Indicator_Form, t: TFunction) =>
  indicator.name.trim() || autoIndicatorName(indicator, t);

// A média do RSI: "Média de RSI14 (MME 9)"
export const averageLabel = (indicator: Indicator_Form, t: TFunction) =>
  t('trading.rsiAverageOf', {
    name: indicatorLabel(indicator, t),
    kind: indicator.smoothing ? t(`trading.kindShort_${indicator.smoothing}`) : '',
    period: indicator.smoothingPeriod,
  });

// Uma linha de um indicador: a dele ou, num RSI com média, a da média
export const lineLabel = (indicator: Indicator_Form, line: Value_Line, t: TFunction) =>
  line === 'average' && hasSmoothing(indicator.kind) && indicator.smoothing
    ? averageLabel(indicator, t)
    : indicatorLabel(indicator, t);

/**
 * Um nome que ainda não existe entre `taken`: "MM21", "MM21 (2)", "MM21 (3)"…
 * Para dois indicadores iguais não ficarem com o mesmo nome na lista.
 */
export const uniqueName = (name: string, taken: string[]) => {
  if (!taken.includes(name)) return name;
  let copy = 2;
  while (taken.includes(`${name} (${copy})`)) copy++;
  return `${name} (${copy})`;
};

/** Dá o nome automático aos indicadores sem nome (os de simulações antigas). */
export const nameIndicators = (indicators: Indicator_Form[], t: TFunction) =>
  indicators.reduce<Indicator_Form[]>((named, indicator) => {
    const name =
      indicator.name.trim() ||
      uniqueName(
        autoIndicatorName(indicator, t),
        named.map((item) => item.name),
      );
    return [...named, { ...indicator, name }];
  }, []);

// "há 1 vela", "há 3 velas"; nada para a última fechada
export const backLabel = (back: number, t: TFunction) => (back > 0 ? t('trading.candlesAgo', { count: back }) : '');

// O que fica à vista ao lado da lista: "há 1 vela · 1 dia"
export const valueDetails = (form: Value_Form, t: TFunction) => {
  const parts: string[] = [];
  if (form.kind === 'candle' && form.source !== 'open_current') {
    if (form.back > 0) parts.push(backLabel(form.back, t));
    if (form.timeframe) parts.push(t(`trading.tf_${form.timeframe}`));
  }
  if (form.kind === 'candle' && form.source === 'open_current' && form.timeframe) {
    parts.push(t(`trading.tf_${form.timeframe}`));
  }
  if (form.kind === 'window') {
    if (form.back > 0) parts.push(backLabel(form.back, t));
    if (form.timeframe) parts.push(t(`trading.tf_${form.timeframe}`));
  }
  if (form.kind === 'session' && isRangeLevel(form.level)) {
    parts.push(t('trading.rangeText', { start: form.rangeStart, minutes: form.rangeMinutes }));
  }
  if (form.kind === 'indicator' && form.back > 0) parts.push(backLabel(form.back, t));
  return parts.join(' · ');
};

// De que sessão é um valor do perfil: "sessão anterior", "há 3 sessões", "em desenvolvimento", "virgem"
export const profileSourceLabel = (form: Value_Form, t: TFunction) =>
  form.profileSource === 'session'
    ? t('trading.profileSourceSession', { count: Number(form.sessionsBack) || 1 })
    : t(`trading.profileSource_${form.profileSource}`);

// Um valor do perfil: "POC da sessão anterior"; com mais de um perfil, também o nome dele
const profileLabel = (form: Value_Form, indicator: Indicator_Form, indicators: Indicator_Form[], t: TFunction) => {
  const text = t('trading.profileValue', { level: t(`trading.profileLevel_${form.profileLevel}`), source: profileSourceLabel(form, t) });
  return indicators.filter((item) => isProfile(item.kind)).length > 1 ? `${text} · ${indicatorLabel(indicator, t)}` : text;
};

// O valor inteiro numa frase: "Fecho · há 1 vela", "MM21", "50000", "Abertura (mercado)"
export const valueLabel = (form: Value_Form, indicators: Indicator_Form[], t: TFunction) => {
  let main: string;
  if (form.kind === 'market') main = t('trading.kind_market');
  else if (form.kind === 'number') main = form.value;
  else if (form.kind === 'indicator') {
    const indicator = indicators.find((item) => item.id === form.indicatorId);
    main = !indicator
      ? t('trading.indicatorMissing')
      : isProfile(indicator.kind)
        ? profileLabel(form, indicator, indicators, t)
        : lineLabel(indicator, form.line, t);
  } else if (form.kind === 'window') {
    // "Máxima de 20 velas"; com outro campo, "Máxima de 20 velas (fecho)"
    main = t(`trading.windowLabel_${form.windowKind}`, { count: Number(form.period) || 0 });
    const usual = form.windowKind === 'lowest' ? 'low' : 'high';
    if (!isCountKind(form.windowKind) && form.source !== usual) {
      main += ` (${t(`trading.source_${form.source}`).toLowerCase()})`;
    }
  } else if (form.kind === 'session') main = t(`trading.session_${form.level}`);
  else main = t(`trading.source_${form.source}`);

  const details = valueDetails(form, t);
  return details ? `${main} · ${details}` : main;
};

// Como se escreve uma condição: o operador ("acima de" ou ">") e a % do lado direito
export interface Condition_Text_Format {
  operator: (condition: Condition_Form) => string;
  pct: (value: number) => string;
}

// "nas últimas 5 velas (nalguma)" / "nas últimas 3 velas seguidas"; nada se for agora
const withinText = (condition: Condition_Form, t: TFunction) =>
  condition.withinMode ? ` ${t(`trading.withinText_${condition.withinMode}`, { count: Number(condition.withinBars) || 0 })}` : '';

/**
 * Uma condição numa frase: "Fecho acima de MM21 +1%", "RSI14 entre 30 e 70",
 * "(Fecho acima de MM21 ou RSI14 abaixo de 30) nas últimas 3 velas".
 */
export const conditionText = (
  condition: Condition_Form,
  indicators: Indicator_Form[],
  t: TFunction,
  format: Condition_Text_Format,
): string => {
  if (condition.group) {
    const joiner = t(condition.groupMatch === 'any' ? 'trading.or' : 'trading.and');
    const inner = condition.group.map((item) => conditionText(item, indicators, t, format)).join(` ${joiner} `);
    return `(${inner})${withinText(condition, t)}`;
  }
  const extra = Number(condition.rightPct.replace(',', '.'));
  const side = (operand: Value_Form) => `${valueLabel(operand, indicators, t)}${extra ? ` ${format.pct(extra)}` : ''}`;
  const right = isBetween(condition.operator)
    ? `${side(condition.right)} ${t('trading.betweenAnd')} ${side(condition.rightTo)}`
    : side(condition.right);
  return `${valueLabel(condition.left, indicators, t)} ${format.operator(condition)} ${right}${withinText(condition, t)}`;
};

// O stop numa frase curta: "Stop loss −2%", "Stop loss na mínima de 10 velas", "Stop loss em Mínima"
export const stopText = (entry: Entry_Form, indicators: Indicator_Form[], t: TFunction, pct: (text: string) => string) => {
  if (entry.stopMode === 'pct') return entry.stopLossPct.trim() ? t('trading.shExitStop', { pct: pct(entry.stopLossPct) }) : null;
  const buffer = entry.stopBufferPct.trim() ? ` ${t('trading.shStopBuffer', { pct: pct(entry.stopBufferPct) })}` : '';
  const side = entry.side === 'short' ? 'short' : 'long';
  return entry.stopMode === 'swing'
    ? `${t(`trading.shExitStopSwing_${side}`, { count: Number(entry.stopBars) || 0 })}${buffer}`
    : `${t('trading.shExitStopLevel', { level: valueLabel(entry.stopLevel, indicators, t) })}${buffer}`;
};

// O take numa frase curta: "Take profit +4%" ou "Take profit a 2R"
export const takeText = (entry: Entry_Form, t: TFunction, pct: (text: string) => string) => {
  if (entry.takeMode === 'r') return entry.takeR.trim() ? t('trading.shExitTakeR', { value: entry.takeR }) : null;
  return entry.takeProfitPct.trim() ? t('trading.shExitTake', { pct: pct(entry.takeProfitPct) }) : null;
};

// As saídas parciais: "Fecha 50% a +1% (stop para a entrada)"
export const partialTexts = (entry: Entry_Form, t: TFunction, pct: (text: string) => string) =>
  entry.partials.map((part) =>
    t(part.moveStop ? 'trading.shPartialMove' : 'trading.shPartial', {
      close: pct(part.closePct),
      at: part.mode === 'r' ? `${part.value}R` : `+${pct(part.value)}`,
    }),
  );

// As condições de uma lista numa frase, juntas por E/OU
const conditionsText = (
  conditions: Condition_Form[],
  match: string,
  indicators: Indicator_Form[],
  t: TFunction,
  format: Condition_Text_Format,
) =>
  conditions
    .map((item) => conditionText(item, indicators, t, format))
    .join(` ${t(match === 'any' ? 'trading.or' : 'trading.and')} `);

// A preparação: "Primeiro: Fecho < MM21 (fica 5 velas)" e, se houver, "Cancela se: …"
export const setupTexts = (entry: Entry_Form, indicators: Indicator_Form[], t: TFunction, format: Condition_Text_Format) => {
  if (!entry.setup) return [];
  const setup = entry.setup;
  return [
    t('trading.shSetup', {
      conditions: conditionsText(setup.conditions, setup.match, indicators, t, format),
      count: Number(setup.bars) || 0,
    }),
    ...(setup.cancel.length
      ? [t('trading.shSetupCancel', { conditions: conditionsText(setup.cancel, setup.cancelMatch, indicators, t, format) })]
      : []),
  ];
};

// As condições da conta: "Só se: perdas seguidas < 3", "Só se: o último trade desta entrada foi uma perda"
export const contextTexts = (entry: Entry_Form, t: TFunction) =>
  entry.context.map((rule) => {
    const scope = contextHasScope(rule.kind) ? ` ${t(`trading.contextScopeText_${rule.scope}`)}` : '';
    if (rule.kind === 'lastTrade') {
      return t('trading.shContextLast', { scope, result: t(`trading.contextResult_${rule.result}`).toLowerCase() });
    }
    const signs = { lt: '<', lte: '≤', eq: '=', gte: '≥', gt: '>' };
    const value = `${rule.value}${contextIsPct(rule.kind) ? '%' : ''}`;
    return t('trading.shContext', {
      what: `${t(`trading.context_${rule.kind}`)}${scope}`,
      operator: signs[rule.operator],
      value,
    });
  });

// A favor: "1R" ou "+2%"
const profitText = (mode: string, value: string, pct: (text: string) => string) =>
  mode === 'r' ? `${value}R` : `+${pct(value)}`;

// Os ajustes do stop: "A 1R a favor: stop para a entrada", "Sempre: stop na mínima de 3 velas"
export const stopRuleTexts = (
  entry: Entry_Form,
  indicators: Indicator_Form[],
  t: TFunction,
  format: Condition_Text_Format,
  pct: (text: string) => string,
) =>
  entry.stopRules.map((rule) => {
    const when =
      rule.trigger === 'profit'
        ? t('trading.shStopRuleProfit', { at: profitText(rule.profitMode, rule.profitValue, pct) })
        : rule.trigger === 'conditions'
          ? t('trading.shStopRuleConditions', { conditions: conditionsText(rule.conditions, rule.match, indicators, t, format) })
          : t('trading.shStopRuleAlways');
    const side = entry.side === 'short' ? 'short' : 'long';
    const buffer = rule.bufferPct.trim() && rule.to !== 'entry' && rule.to !== 'trail'
      ? ` ${t('trading.shStopBuffer', { pct: pct(rule.bufferPct) })}`
      : '';
    const to =
      rule.to === 'swing'
        ? t(`trading.shStopRuleSwing_${side}`, { count: Number(rule.bars) || 0 })
        : rule.to === 'level'
          ? t('trading.shStopRuleLevel', { level: valueLabel(rule.level, indicators, t) })
          : rule.to === 'trail'
            ? t('trading.shStopRuleTrail', { pct: pct(rule.trailPct) })
            : t('trading.shStopRuleEntry');
    return `${when}: ${to}${buffer}`;
  });

// Os reforços: "Junta 50% a 1R (stop para a entrada)", "Junta 100% com Fecho > MM21"
export const scaleInTexts = (
  entry: Entry_Form,
  indicators: Indicator_Form[],
  t: TFunction,
  format: Condition_Text_Format,
  pct: (text: string) => string,
) =>
  entry.scaleIns.map((add) => {
    const text =
      add.trigger === 'profit'
        ? t('trading.shScaleInProfit', { size: pct(add.sizePct), at: profitText(add.profitMode, add.profitValue, pct) })
        : t('trading.shScaleInConditions', {
            size: pct(add.sizePct),
            conditions: conditionsText(add.conditions, add.match, indicators, t, format),
          });
    return add.moveStop ? `${text} ${t('trading.shScaleInMove')}` : text;
  });

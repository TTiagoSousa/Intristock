import { useMemo } from 'react';
import { useTranslation } from 'react-i18next';
import type { Live_Event } from '../../../../Hooks/Trading/useLiveTests';
import type { Exit_Reason, Operator, Simulation_Run } from '../../../../Hooks/Trading/useSimulation';
import { formatNumber, formatPrice } from '../Trading_Simulator/format';
import { chartExitKeyOf, entryLabel, exitLabel } from '../Trading_Simulator/labels';
import { fromRun } from '../Trading_Simulator/simulationForm';
import type { Condition_Form, Entry_Form } from '../Trading_Simulator/simulationForm';
import { conditionText } from '../Trading_Simulator/valueLabels';
import { moneyUnit } from './factsheetFormat';

// As comparações escrevem-se como sinais; os cruzamentos por extenso (como na ficha)
const OPERATOR_SIGNS: Partial<Record<Operator, string>> = { gt: '>', gte: '≥', lt: '<', lte: '≤' };

// O grupo de cada registo: a cor do ponto e o filtro da lista
export type Live_Category = 'trade' | 'signal' | 'condition' | 'account' | 'system';

const CATEGORY: Record<string, Live_Category> = {
  opened: 'trade',
  partial: 'trade',
  add: 'trade',
  stopMove: 'trade',
  closed: 'trade',
  touch: 'trade',
  signal: 'signal',
  order: 'signal',
  setup: 'signal',
  conditionsMet: 'signal',
  condition: 'condition',
  conditionsSnapshot: 'condition',
  deposit: 'account',
  pause: 'account',
  system: 'system',
};

export const categoryOf = (kind: string): Live_Category => CATEGORY[kind] ?? 'system';

// Uma condição do estado (o id do simulador): de que entrada, onde e a posição
export interface Condition_Slot {
  id: string;
  scope: 'entry' | 'setup' | 'exit';
  entry: number;
  exit: number | null;
  path: number[];
  condition: Condition_Form;
  depth: number;
}

// As condições de uma lista com os ids que o simulador lhes dá ("entry:1:0:2", "entry:1:0:2.0")
const slotsOf = (scope: Condition_Slot['scope'], entry: number, exit: number | null, conditions: Condition_Form[]) =>
  conditions.flatMap((condition, index) => {
    const base = `${scope}:${entry}:${exit ?? 0}:${index}`;
    const own: Condition_Slot = { id: base, scope, entry, exit, path: [index], condition, depth: 0 };
    const children = (condition.group ?? []).map((child, childIndex) => ({
      id: `${base}.${childIndex}`,
      scope,
      entry,
      exit,
      path: [index, childIndex],
      condition: child,
      depth: 1,
    }));
    return [own, ...children];
  });

export interface Entry_Slots {
  entry: number;
  form: Entry_Form;
  conditions: Condition_Slot[];
  setup: Condition_Slot[];
  exits: { exit: number; name: string; conditions: Condition_Slot[] }[];
}

/**
 * Os textos do teste ao vivo: cada registo numa frase ("Sinal da Entrada 1 →
 * bloqueado pelo horário", "Fechou a compra (Entrada 1) por Stop loss a 67 210,5:
 * −12,40 $") e as condições de cada entrada escritas como na ficha, com o id que o
 * simulador lhes dá no estado.
 */
export const useLiveTexts = (run: Simulation_Run) => {
  const { t, i18n } = useTranslation();
  const language = i18n.language;
  const timezone = run.strategy.timezone ?? 'UTC';
  const unit = moneyUnit(run.instrument.quote);

  return useMemo(() => {
    const form = fromRun(run);
    const entries = run.strategy.entries ?? [];
    const short = (value: number) => {
      const digits = Number.isInteger(value) ? 0 : Number.isInteger(value * 10) ? 1 : Number.isInteger(value * 100) ? 2 : 4;
      return formatNumber(value, language, digits);
    };
    const format = {
      operator: ({ operator }: Condition_Form) => OPERATOR_SIGNS[operator] ?? t(`trading.operator_${operator}`),
      pct: (value: number) => `${value > 0 ? '+' : '−'}${short(Math.abs(value))}%`,
    };
    const price = (value: unknown) => (typeof value === 'number' ? formatPrice(value, language) : '—');
    const money = (value: unknown) =>
      typeof value === 'number' ? `${value > 0 ? '+' : value < 0 ? '−' : ''}${formatNumber(Math.abs(value), language)} ${unit}` : '—';
    const quantity = (value: unknown) =>
      typeof value === 'number' ? value.toLocaleString(language, { maximumFractionDigits: 6 }) : '—';
    const moment = (value: unknown) =>
      typeof value === 'number'
        ? new Date(value).toLocaleString(language, {
            day: '2-digit',
            month: '2-digit',
            hour: '2-digit',
            minute: '2-digit',
            timeZone: timezone,
          })
        : '—';
    const entryName = (rule: unknown) => entryLabel(entries, Number(rule) || 1, t);
    const side = (value: unknown) => t(value === 'short' ? 'trading.liveSide_short' : 'trading.liveSide_long');

    const slots: Entry_Slots[] = form.entries.map((entry, index) => ({
      entry: index + 1,
      form: entry,
      conditions: slotsOf('entry', index + 1, null, entry.conditions),
      setup: entry.setup ? slotsOf('setup', index + 1, null, entry.setup.conditions) : [],
      exits: entry.exits.map((exit, exitIndex) => ({
        exit: exitIndex + 1,
        name: exit.name || t('trading.exitTitle', { position: exitIndex + 1 }),
        conditions: slotsOf('exit', index + 1, exitIndex + 1, exit.conditions),
      })),
    }));
    const slotById = new Map(
      slots.flatMap((entry) => [...entry.conditions, ...entry.setup, ...entry.exits.flatMap((exit) => exit.conditions)]).map(
        (slot) => [slot.id, slot],
      ),
    );

    const conditionLabel = (slot: Condition_Slot) => conditionText(slot.condition, form.indicators, t, format);

    // Onde está a condição: "Entrada 1", "Entrada 1 · preparação", "Entrada 1 · Saída 2"
    const whereOf = (slot: Condition_Slot) => {
      const name = entryName(slot.entry);
      if (slot.scope === 'setup') return `${name} · ${t('trading.liveWhere_setup')}`;
      if (slot.scope === 'exit') {
        const exit = slots[slot.entry - 1]?.exits[(slot.exit ?? 1) - 1];
        return `${name} · ${exit?.name ?? t('trading.exitTitle', { position: slot.exit })}`;
      }
      return name;
    };

    const text = (event: Live_Event): string => {
      const data = event.data;
      switch (event.kind) {
        case 'system':
          return t(`trading.liveSys_${String(data.code)}`, {
            minutes: data.minutes,
            source: String(data.source ?? '').toUpperCase(),
            reason: data.reason,
            startAt: moment(data.startAt),
          });
        case 'conditionsSnapshot': {
          const values = (data.values ?? {}) as Record<string, boolean>;
          const met = entries.map((_, index) => values[`met:${index + 1}`]).filter(Boolean).length;
          return t('trading.liveSnapshot', { met, total: entries.length });
        }
        case 'condition': {
          const slot = slotById.get(String(data.id));
          if (!slot) return t('trading.liveConditionUnknown');
          return t(data.value ? 'trading.liveCondition_true' : 'trading.liveCondition_false', {
            where: whereOf(slot),
            condition: conditionLabel(slot),
          });
        }
        case 'conditionsMet':
          return t(data.value ? 'trading.liveMet_true' : 'trading.liveMet_false', { entry: entryName(data.entry) });
        case 'setup':
          return t(`trading.liveSetup_${String(data.event)}`, { entry: entryName(data.entry) });
        case 'signal':
          return t(`trading.liveSignal_${String(data.outcome)}`, {
            entry: entryName(data.entry),
            defaultValue: t('trading.liveSignal_other', { entry: entryName(data.entry), reason: String(data.outcome) }),
          });
        case 'order':
          return t(`trading.liveOrder_${String(data.event)}`, {
            entry: entryName(data.entry),
            price: price(data.price),
            reason: data.reason ? t(`trading.liveReason_${String(data.reason)}`) : '',
          });
        case 'opened':
          return t('trading.liveOpened', {
            side: side(data.side),
            entry: entryName(data.entry),
            price: price(data.price),
            quantity: quantity(data.quantity),
            stop: data.stop == null ? t('trading.liveNone') : price(data.stop),
            take: data.take == null ? t('trading.liveNone') : price(data.take),
          });
        case 'partial':
          return t('trading.livePartial', {
            entry: entryName(data.entry),
            quantity: quantity(data.quantity),
            price: price(data.price),
            pnl: data.pnl == null ? '' : ` (${money(data.pnl)})`,
          });
        case 'add':
          return t('trading.liveAdd', { entry: entryName(data.entry), n: data.n, quantity: quantity(data.quantity), price: price(data.price) });
        case 'stopMove':
          return t('trading.liveStopMove', { entry: entryName(data.entry), level: price(data.level) });
        case 'closed': {
          const exit = chartExitKeyOf({ exitReason: String(data.reason) as Exit_Reason, exitRule: (data.exitRule as number | null) ?? null });
          return t('trading.liveClosed', {
            side: side(data.side),
            entry: entryName(data.entry),
            exit: exitLabel(entries, Number(data.entry) || 1, exit, t),
            price: price(data.price),
            pnl: money(data.pnl),
            pct: typeof data.pnlPct === 'number' ? `${data.pnlPct > 0 ? '+' : ''}${formatNumber(data.pnlPct, language)}%` : '—',
          });
        }
        case 'touch':
          return t(data.what === 'take' ? 'trading.liveTouch_take' : 'trading.liveTouch_stop', {
            entry: entryName(data.entry),
            level: price(data.level),
            price: price(data.price),
          });
        case 'deposit':
          return t('trading.liveDeposit', { amount: money(data.amount) });
        case 'pause':
          return t('trading.livePause', { until: moment(data.until), guard: data.guard });
        default:
          return event.kind;
      }
    };

    // A hora de um registo no fuso da estratégia (com os segundos)
    const time = (value: number) =>
      new Date(value).toLocaleString(language, {
        day: '2-digit',
        month: '2-digit',
        hour: '2-digit',
        minute: '2-digit',
        second: '2-digit',
        timeZone: timezone,
      });

    return { text, time, moment, slots, conditionLabel, entryName, price, money, quantity, side };
  }, [run, t, language, timezone, unit]);
};

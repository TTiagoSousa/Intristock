// As contas pequenas do quadro das Leads (sem rede, testadas em leadHelpers.test.ts)
import type { Data_Value } from '../../../../Hooks/Companies/useCompanyData';
import type { Lead_Card } from '../../../../Hooks/Companies/useCompanyLeads';

/**
 * O lugar de um cartão largado entre dois: o meio das posições dos vizinhos (sem um deles, um passo para lá
 * do outro). As leads que ninguém mexeu têm posições grandes (a ordem da origem), por isso cabem sempre.
 */
export const positionBetween = (before: number | undefined, after: number | undefined) => {
  if (before !== undefined && after !== undefined) return (before + after) / 2;
  if (before !== undefined) return before + 1;
  if (after !== undefined) return after - 1;
  return 1;
};

/** O título de um cartão: a coluna do título, senão a linha (numa unida, só os lados que existem). */
export const cardTitle = (card: Pick<Lead_Card, 'rowKey'>, titleColumn: string | null, values: Record<string, Data_Value>) => {
  const value = titleColumn ? values[titleColumn] : null;
  if (value !== null && value !== undefined && String(value).trim()) return String(value);
  return card.rowKey.split('|').filter(Boolean).join(' · ') || card.rowKey;
};

/**
 * A posição de um cartão largado no lugar `index` de uma coluna (os cartões dela por ordem, sem o que se arrasta):
 * entre o de cima e o de baixo.
 */
export const dropPosition = (column: Pick<Lead_Card, 'position'>[], index: number) =>
  positionBetween(column[index - 1]?.position, column[index]?.position);

/** O lugar onde um cartão cai numa coluna: o primeiro cartão cujo meio está abaixo do rato. */
export const dropIndex = (middles: number[], pointerY: number) => {
  const index = middles.findIndex((middle) => pointerY < middle);
  return index === -1 ? middles.length : index;
};

/** As iniciais de quem comentou (a primeira e a última palavra do nome), para o círculo do comentário. */
export const initialsOf = (name: string | null) => {
  const words = (name ?? '').trim().split(/\s+/).filter(Boolean);
  if (!words.length) return '?';
  const first = words[0][0] ?? '';
  const last = words.length > 1 ? (words[words.length - 1][0] ?? '') : '';
  return (first + last).toLocaleUpperCase('pt-PT');
};

const UNITS: [Intl.RelativeTimeFormatUnit, number][] = [
  ['minute', 60],
  ['hour', 60 * 60],
  ['day', 60 * 60 * 24],
];

/**
 * Há quanto tempo, como se diz («agora», «há 5 min», «há 3 h», «ontem»); a partir de uma semana, a data. A hora
 * exata fica no `title` de quem a mostra.
 */
export const relativeTime = (iso: string, now: Date, locale: string) => {
  const date = new Date(iso);
  const seconds = Math.round((now.getTime() - date.getTime()) / 1000);
  if (seconds < 45) return new Intl.RelativeTimeFormat(locale, { numeric: 'auto' }).format(0, 'second');
  if (seconds >= 7 * 24 * 60 * 60) return date.toLocaleDateString(locale, { day: 'numeric', month: 'short', year: date.getFullYear() === now.getFullYear() ? undefined : 'numeric' });
  const format = new Intl.RelativeTimeFormat(locale, { numeric: 'auto', style: 'short' });
  let unit = UNITS[0];
  for (const candidate of UNITS) if (seconds >= candidate[1]) unit = candidate;
  return format.format(-Math.max(1, Math.floor(seconds / unit[1])), unit[0]);
};

/** O dia de uma data para separar a conversa: «hoje», «ontem» ou a data (com o ano só noutro ano). */
export const dayLabel = (iso: string, now: Date, locale: string) => {
  const date = new Date(iso);
  const startOf = (d: Date) => new Date(d.getFullYear(), d.getMonth(), d.getDate()).getTime();
  const days = Math.round((startOf(now) - startOf(date)) / 86_400_000);
  if (days === 0 || days === 1) return new Intl.RelativeTimeFormat(locale, { numeric: 'auto' }).format(-days, 'day');
  return date.toLocaleDateString(locale, { weekday: 'short', day: 'numeric', month: 'short', year: date.getFullYear() === now.getFullYear() ? undefined : 'numeric' });
};

/** A chave do dia local (para juntar os comentários do mesmo dia). */
export const dayKey = (iso: string) => {
  const date = new Date(iso);
  return `${date.getFullYear()}-${date.getMonth()}-${date.getDate()}`;
};

export type Lead_Quick_Filter = 'all' | 'mine' | 'unassigned' | 'callbacks' | 'stale';

const DAY_MS = 86_400_000;

/** Quantos dias a lead está na coluna (as que ninguém mexeu, desde que entraram). */
export const daysInStage = (card: Pick<Lead_Card, 'stageEnteredAt'>, now: Date) =>
  card.stageEnteredAt ? Math.max(0, Math.floor((now.getTime() - new Date(card.stageEnteredAt).getTime()) / DAY_MS)) : 0;

/** O voltar a ligar: já passou a hora, é hoje ou é noutro dia. */
export const callbackState = (callbackAt: string | null, now: Date): 'overdue' | 'today' | 'later' | null => {
  if (!callbackAt) return null;
  const at = new Date(callbackAt);
  if (at.getTime() <= now.getTime()) return 'overdue';
  return at.toDateString() === now.toDateString() ? 'today' : 'later';
};

/** Ignora acentos e maiúsculas (para «joao» encontrar «João»). */
const fold = (value: string) => value.normalize('NFD').replace(/[̀-ͯ]/g, '').toLowerCase();

/**
 * Os cartões que passam a pesquisa (nos valores que o cartão tem: o título, o telefone e as colunas dele; num
 * telefone também só pelos números) e o filtro rápido.
 */
export const filterCards = (
  cards: Lead_Card[],
  input: { query: string; quick: Lead_Quick_Filter; staleDays: number; me: string; now: Date },
) => {
  const needle = fold(input.query.trim());
  const digits = input.query.replace(/\D/g, '');
  return cards.filter((card) => {
    if (input.quick === 'mine' && card.assignedToId !== input.me) return false;
    if (input.quick === 'unassigned' && card.assignedToId) return false;
    if (input.quick === 'callbacks') {
      const state = callbackState(card.callbackAt, input.now);
      if (state !== 'overdue' && state !== 'today') return false;
    }
    if (input.quick === 'stale' && daysInStage(card, input.now) < input.staleDays) return false;
    if (!needle) return true;
    const texts = [card.rowKey, ...Object.values(card.values).map((v) => (v === null || v === undefined ? '' : String(v)))];
    return texts.some((text) => fold(text).includes(needle) || (digits.length >= 3 && text.replace(/\D/g, '').includes(digits)));
  });
};

/** Uma data para um `<input type="datetime-local">` (na hora local) e de volta para ISO. */
export const toLocalInput = (date: Date) => {
  const pad = (n: number) => String(n).padStart(2, '0');
  return `${date.getFullYear()}-${pad(date.getMonth() + 1)}-${pad(date.getDate())}T${pad(date.getHours())}:${pad(date.getMinutes())}`;
};

export const fromLocalInput = (value: string) => {
  if (!value) return null;
  const date = new Date(value);
  return Number.isNaN(date.getTime()) ? null : date.toISOString();
};

/** Daqui a umas horas, à hora certa (o que se propõe ao marcar o voltar a ligar). */
export const suggestCallback = (now: Date, hours = 2) => {
  const at = new Date(now.getTime() + hours * 3_600_000);
  at.setMinutes(0, 0, 0);
  return at;
};

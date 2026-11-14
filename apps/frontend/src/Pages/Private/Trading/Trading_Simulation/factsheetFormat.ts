import { useTranslation } from 'react-i18next';
import { formatNumber } from '../Trading_Simulator/format';
import type { Tone } from './Factsheet_Card';

// As moedas que se mostram como $
const DOLLAR_QUOTES = ['USDT', 'USDC', 'USD'];

// As cores das entradas (o quadrado ao lado do nome), pela ordem da lista
const ENTRY_COLORS = 6;

export const entryColor = (rule: number) => ((rule - 1) % ENTRY_COLORS) + 1;

// A classe da cor de cada tipo de saída (os stops todos da mesma cor, os alvos também)
export const exitColorClass = (reason: string) =>
  ({
    stop_loss: 'Exit_Stop',
    trailing_stop: 'Exit_Trailing',
    break_even: 'Exit_Break_Even',
    take_profit: 'Exit_Take',
    signal: 'Exit_Signal',
    time: 'Exit_Time',
  })[reason] ?? 'Exit_Other';

// O token da cor de cada tipo de saída (para os gráficos, que não leem classes)
export const exitColorToken = (reason: string) =>
  ({
    stop_loss: 'exit-stop',
    trailing_stop: 'exit-trailing',
    break_even: 'exit-break-even',
    take_profit: 'exit-take',
    signal: 'exit-signal',
    time: 'exit-time',
  })[reason] ?? 'exit-other';

/**
 * Um token do relatório já como cor que o canvas lê: os que usam color-mix()
 * resolvem-se pondo-os num elemento e lendo a cor calculada.
 */
export const resolveColor = (root: HTMLElement, css: string) => {
  const probe = document.createElement('span');
  probe.style.color = css;
  root.appendChild(probe);
  const computed = getComputedStyle(probe).color;
  probe.remove();
  if (computed.startsWith('rgb')) return computed;
  // color-mix() calcula-se como color(srgb …): passa-se por um pixel para dar #rrggbb
  const canvas = document.createElement('canvas');
  canvas.width = canvas.height = 1;
  const context = canvas.getContext('2d', { willReadFrequently: true });
  if (!context) return computed;
  context.fillStyle = computed;
  context.fillRect(0, 0, 1, 1);
  const [r, g, b] = context.getImageData(0, 0, 1, 1).data;
  return `#${[r, g, b].map((value) => value.toString(16).padStart(2, '0')).join('')}`;
};

export const resolveToken = (root: HTMLElement, name: string) => resolveColor(root, `var(--factsheet-${name})`);

// A moeda do P&L como se mostra ("$" ou a cotada)
// Uma hora do dia como no relatório: 00h a 23h
export const hourLabel = (hour: number) => `${String(hour).padStart(2, '0')}h`;

export const moneyUnit = (quote: string) => (DOLLAR_QUOTES.includes(quote) ? '$' : quote);

/**
 * Os formatos das tabelas da página Entradas e saídas: o menos tipográfico, o +
 * nos valores com sinal, "—" nos nulos e a cor (Positive / Negative) pelo sinal.
 */
export const useFactsheetFormat = (unit: string) => {
  const { i18n } = useTranslation();
  const language = i18n.language;

  const number = (value: number | null | undefined, digits = 0) =>
    value == null ? '—' : `${value < 0 ? '−' : ''}${formatNumber(Math.abs(value), language, digits)}`;
  const signed = (value: number | null | undefined, digits = 0) =>
    value == null ? '—' : `${value > 0 ? '+' : value < 0 ? '−' : ''}${formatNumber(Math.abs(value), language, digits)}`;
  const percent = (value: number | null | undefined, digits = 1) => (value == null ? '—' : `${number(value, digits)}%`);
  const signedPercent = (value: number | null | undefined, digits = 1) => (value == null ? '—' : `${signed(value, digits)}%`);
  const money = (value: number | null | undefined, digits = 0) => (value == null ? '—' : `${signed(value, digits)} ${unit}`);
  const r = (value: number | null | undefined) => (value == null ? '—' : `${signed(value, 2)}R`);
  const tone = (value: number | null | undefined): Tone => (value == null ? '' : value > 0 ? 'Positive' : value < 0 ? 'Negative' : '');

  return { language, number, signed, percent, signedPercent, money, r, tone };
};

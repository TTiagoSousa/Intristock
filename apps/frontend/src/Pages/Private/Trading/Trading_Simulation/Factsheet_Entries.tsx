import { useMemo } from 'react';
import { useTranslation } from 'react-i18next';
import type { Operator, Simulation_Run } from '../../../../Hooks/Trading/useSimulation';
import { formatNumber } from '../Trading_Simulator/format';
import { effectiveSide, fromRun } from '../Trading_Simulator/simulationForm';
import type { Condition_Form, Entry_Form } from '../Trading_Simulator/simulationForm';
import type { Schedule_Form } from '../Trading_Simulator/strategyOptions';
import {
  conditionText,
  contextTexts,
  partialTexts,
  scaleInTexts,
  setupTexts,
  stopRuleTexts,
  stopText,
  takeText,
  valueLabel,
} from '../Trading_Simulator/valueLabels';
import Factsheet_Explain from './Factsheet_Explain';

interface Factsheet_Entries_Props {
  run: Simulation_Run;
}

// Uma linha de uma célula: o texto, o que a junta à anterior (E/OU) e se é um detalhe
interface Cell_Line {
  text: string;
  joiner?: string;
  muted?: boolean;
}

// As comparações escrevem-se como sinais; os cruzamentos por extenso
const OPERATOR_SIGNS: Partial<Record<Operator, string>> = { gt: '>', gte: '≥', lt: '<', lte: '≤' };

// As moedas que se mostram como $
const DOLLAR_QUOTES = ['USDT', 'USDC', 'USD'];

// Uma célula: uma linha por condição, saída ou detalhe
const Cell = ({ lines }: { lines: Cell_Line[] }) => (
  <td>
    {lines.length ? (
      lines.map((line, index) => (
        <span key={index} className={`Factsheet_Entries_Line${line.muted ? ' Muted' : ''}`}>
          {line.joiner && <span className="Factsheet_Entries_Joiner">{line.joiner}</span>}
          {line.text}
        </span>
      ))
    ) : (
      <span className="Factsheet_Entries_Line Muted">—</span>
    )}
  </td>
);

/**
 * 2.1 — Estratégia: as entradas, passo a passo. Uma linha por entrada, pelos
 * quatro passos do formulário (entra quando → entra a → com quanto → sai) e o
 * horário; em cada célula, uma condição, saída ou detalhe por linha. Lê a
 * estratégia gravada como o formulário a lê (`fromRun`), para as condições se
 * escreverem com os mesmos nomes.
 */
const Factsheet_Entries = ({ run }: Factsheet_Entries_Props) => {
  const { t, i18n } = useTranslation();
  const language = i18n.language;
  const form = useMemo(() => fromRun(run), [run]);
  const spot = run.instrument.type === 'spot';
  const unit = DOLLAR_QUOTES.includes(run.instrument.quote) ? '$' : run.instrument.quote;

  // Sem casas a mais: 2 e não 2,0; os textos do formulário podem vir com vírgula
  const short = (value: number) => {
    const digits = Number.isInteger(value) ? 0 : Number.isInteger(value * 10) ? 1 : Number.isInteger(value * 100) ? 2 : 4;
    return formatNumber(value, language, digits);
  };
  const read = (text: string) => Number(text.replace(',', '.'));
  const pct = (text: string) => `${short(read(text))}%`;
  const signedPct = (value: number) => `${value > 0 ? '+' : '−'}${short(Math.abs(value))}%`;

  const format = {
    operator: ({ operator }: Condition_Form) => OPERATOR_SIGNS[operator] ?? t(`trading.operator_${operator}`),
    pct: signedPct,
  };
  const condition = (item: Condition_Form) => conditionText(item, form.indicators, t, format);
  const joinerOf = (match: string) => t(match === 'any' ? 'trading.or' : 'trading.and').toUpperCase();
  const conditionLines = (items: Condition_Form[], match: string): Cell_Line[] =>
    items.map((item, index) => ({ text: condition(item), joiner: index > 0 ? joinerOf(match) : undefined }));
  // Entra quando: a preparação primeiro, depois as condições e as da conta
  const when = (entry: Entry_Form): Cell_Line[] => [
    ...setupTexts(entry, form.indicators, t, format).map((text) => ({ text, muted: true })),
    ...conditionLines(entry.conditions, entry.match),
    ...contextTexts(entry, t).map((text) => ({ text, muted: true })),
  ];

  const enter = (entry: Entry_Form): Cell_Line[] =>
    entry.price.kind === 'market'
      ? [{ text: t('trading.shEnterMarket') }, { text: t('trading.shEnterMarketDetail'), muted: true }]
      : [
          { text: t('trading.shEnterLevel', { price: valueLabel(entry.price, form.indicators, t) }) },
          {
            text: [
              t('trading.shBars', { count: read(entry.orderBars) || 1 }),
              t(`trading.orderLevel_${entry.orderTrack ? 'track' : 'fixed'}`).toLowerCase(),
            ].join(' · '),
            muted: true,
          },
          ...(entry.orderCancel ? [{ text: t('trading.shOrderCancels'), muted: true }] : []),
        ];

  const size = (entry: Entry_Form): Cell_Line[] => {
    const value = read(entry.sizingValue);
    const amount =
      entry.sizingMode === 'all'
        ? t('trading.sizing_all')
        : entry.sizingMode === 'amount'
          ? `${short(value)} ${unit}`
          : t(`trading.shSizing_${entry.sizingMode}`, { pct: `${short(value)}%` });
    return [
      { text: amount },
      {
        text: [
          spot ? null : `${short(read(entry.leverage) || 1)}×`,
          t('trading.shMaxPositionsShort', { count: read(entry.maxPositions) || 1 }),
        ]
          .filter(Boolean)
          .join(' · '),
        muted: true,
      },
      ...scaleInTexts(entry, form.indicators, t, format, pct).map((text) => ({ text, muted: true })),
    ];
  };

  const exits = (entry: Entry_Form): Cell_Line[] => {
    const lines: Cell_Line[] = [];
    const stop = stopText(entry, form.indicators, t, pct);
    const take = takeText(entry, t, pct);
    if (stop) lines.push({ text: stop });
    if (take) lines.push({ text: take });
    partialTexts(entry, t, pct).forEach((text) => lines.push({ text, muted: true }));
    stopRuleTexts(entry, form.indicators, t, format, pct).forEach((text) => lines.push({ text, muted: true }));
    if (entry.trailingPct.trim()) lines.push({ text: t('trading.shExitTrailing', { pct: pct(entry.trailingPct) }) });
    if (entry.breakEvenPct.trim()) lines.push({ text: t('trading.shExitBreakEven', { pct: pct(entry.breakEvenPct) }) });
    if (entry.maxBars.trim()) lines.push({ text: t('trading.shExitTime', { count: read(entry.maxBars) }) });
    entry.exits.forEach((exit, index) => {
      const name = exit.name.trim();
      if (name) lines.push({ text: name });
      else if (exit.conditions.length) {
        const text = exit.conditions.map(condition).join(` ${joinerOf(exit.match)} `);
        lines.push({ text: t('trading.shExitCondition', { conditions: text }) });
      } else lines.push({ text: t('trading.exitTitle', { position: index + 1 }) });
    });
    return lines;
  };

  // "07:00" → "7h", "07:30" → "7h30"
  const hour = (text: string) => {
    const [h, m] = text.split(':').map(Number);
    return `${h}h${m ? String(m).padStart(2, '0') : ''}`;
  };
  const schedule = (value: Schedule_Form | null): Cell_Line[] => {
    if (!value || !value.rules.length) return [{ text: t('trading.shAlways') }];
    return [
      { text: t(`trading.shScheduleMode_${value.mode}`) },
      ...value.rules.map((rule) => {
        const days = rule.days.length
          ? [...rule.days].sort((a, b) => a - b).map((item) => t(`trading.weekday_${item}`)).join(', ')
          : t('trading.shEveryDay');
        return { text: rule.from && rule.to ? `${days} ${hour(rule.from)}–${hour(rule.to)}` : days, muted: true };
      }),
    ];
  };

  return (
    <div className="Factsheet_Panel">
      <div className="Factsheet_Panel_Header">
        <div className="Factsheet_Panel_Heading">
          <span className="Factsheet_Panel_Title">
            {t('trading.shEntriesTitle')}
            <Factsheet_Explain id="setupEntries" title={t('trading.shEntriesTitle')} />
          </span>
          <span className="Factsheet_Panel_Note">{t('trading.shEntriesNote')}</span>
        </div>
      </div>
      <div className="Factsheet_Table_Scroll">
        <table className="Factsheet_Table Factsheet_Entries">
          <colgroup>
            <col className="Name" />
            <col className="Side" />
            <col className="When" />
            <col className="At" />
            <col className="Size" />
            <col className="Exit" />
            <col className="Schedule" />
          </colgroup>
          <thead>
            <tr>
              <th>{t('trading.shEntriesEntry')}</th>
              <th>{t('trading.shEntriesSide')}</th>
              <th>{t('trading.shEntriesWhen')}</th>
              <th>{t('trading.shEntriesAt')}</th>
              <th>{t('trading.shEntriesSize')}</th>
              <th>{t('trading.shEntriesExit')}</th>
              <th>{t('trading.shEntriesSchedule')}</th>
            </tr>
          </thead>
          <tbody>
            {form.entries.map((entry, index) => {
              const side = effectiveSide(entry, spot);
              return (
                <tr key={entry.id}>
                  <Cell lines={[{ text: entry.name.trim() || t('trading.entryTitle', { position: index + 1 }) }]} />
                  <td>
                    <span className={`Factsheet_Entries_Side ${side === 'long' ? 'Long' : 'Short'}`}>
                      {t(`trading.side_${side}`)}
                    </span>
                  </td>
                  <Cell lines={when(entry)} />
                  <Cell lines={enter(entry)} />
                  <Cell lines={size(entry)} />
                  <Cell lines={exits(entry)} />
                  <Cell lines={schedule(entry.schedule)} />
                </tr>
              );
            })}
          </tbody>
        </table>
      </div>
    </div>
  );
};

export default Factsheet_Entries;

import { useEffect, useMemo, useRef, useState } from 'react';
import { useTranslation } from 'react-i18next';
import { createCalendarChart } from 'openchartscandle/calendar';
import type { CalendarDatum, CalendarTheme } from 'openchartscandle/calendar';
import 'openchartscandle/style.css';
import { useTheme } from '../../../../Contexts/ThemeContext';
import type { Calendar_Daily } from '../../../../Hooks/Trading/useSimulation';
import { Chevron_Left, Chevron_Right } from '../../../../Imports/icons';
import Segmented from '../Trading_Simulator/Segmented';
import Factsheet_Panel from './Factsheet_Panel';
import { resolveColor, resolveToken, useFactsheetFormat } from './factsheetFormat';
import { localeOf } from '../../../../utils/locale';

interface Factsheet_Calendar_Props {
  daily: Calendar_Daily;
  unit: string;
}

// A cor mais forte das células e a dos dias com pouco movimento (em % da cor do
// token) e até quantos anos há um botão para cada um (com mais, só as setas e o
// ano)
const TINT_MAX = 75;
const TINT_SOFT = 35;
const YEAR_BUTTONS = 8;

/**
 * 5.5 — O P&L de cada dia num mapa de calor de calendário
 * (`createCalendarChart`), um ano de cada vez: uma coluna por semana, azul
 * ganhou, laranja perdeu, cinzento sem movimento. O ano escolhe-se por
 * cima do calendário (botões e setas); a escala é a mesma em todos os anos, para
 * se poderem comparar, em cinco intervalos (perda forte e perda, sem movimento,
 * ganho e ganho forte, até ao limite que vem do simulador) que a legenda
 * esconde e mostra com um clique. O tooltip dá a data, o P&L e os trades e stops do dia.
 */
const Factsheet_Calendar = ({ daily, unit }: Factsheet_Calendar_Props) => {
  const { t, i18n } = useTranslation();
  const { theme } = useTheme();
  const f = useFactsheetFormat(unit);
  const rootRef = useRef<HTMLDivElement>(null);
  const chartRef = useRef<HTMLDivElement>(null);

  // Os anos do período; abre no último
  const years = useMemo(() => [...new Set(daily.days.map(([date]) => Number(date.slice(0, 4))))], [daily]);
  const [chosen, setChosen] = useState<number | null>(null);
  const year = chosen != null && years.includes(chosen) ? chosen : years[years.length - 1];
  const position = years.indexOf(year);

  useEffect(() => {
    const element = chartRef.current;
    const root = rootRef.current;
    if (!element || !root || year == null) return;
    let chart: ReturnType<typeof createCalendarChart> | null = null;
    // Na frame seguinte: o data-theme do <html> muda depois deste efeito
    const frame = requestAnimationFrame(() => {
      const token = (name: string) => resolveToken(root, name);
      const tint = (name: string, share = TINT_MAX) =>
        resolveColor(root, `color-mix(in srgb, var(--factsheet-${name}) ${share}%, var(--factsheet-cell-empty))`);
      const calendarTheme: Partial<CalendarTheme> = {
        background: 'transparent',
        text: token('returns-header'),
        muted: token('chart-muted'),
        cell: token('grid-none'),
        cellBorder: 'transparent',
        splitLine: 'transparent',
        tooltipBg: token('chart-tooltip-background'),
        tooltipText: token('chart-tooltip-text'),
        tooltipBorder: token('chart-tooltip-border'),
        font: getComputedStyle(element).fontFamily,
      };
      const scale = Math.max(1, daily.scale ?? 0);
      // Metade da escala separa o forte do fraco; abaixo de `flat` o dia não mexeu
      const half = Math.round(scale / 2);
      const flat = daily.flat;
      // A cor vai até à ponta da escala; o tooltip lê o valor real
      const data: CalendarDatum[] = daily.days
        .filter(([date]) => date.startsWith(String(year)))
        .map(([date, pnl, trades, stops]) => ({ date, value: Math.min(scale, Math.max(-scale, pnl)), pnl, trades, stops }));
      const monthName = new Intl.DateTimeFormat(localeOf(i18n.language), { month: 'short', timeZone: 'UTC' });
      const dayName = new Intl.DateTimeFormat(localeOf(i18n.language), {
        weekday: 'long',
        day: '2-digit',
        month: '2-digit',
        year: 'numeric',
        timeZone: 'UTC',
      });
      const weekdays = [0, 1, 2, 3, 4, 5, 6].map((day) => (day % 2 === 0 ? t(`trading.fsWeekdayShort_${day}`) : ''));

      chart = createCalendarChart(element, {
        // O ano inteiro, para a grelha não mudar; os dias fora do período ficam vazios
        range: year,
        firstDay: 1,
        cellSize: 'auto',
        data,
        // Cinco intervalos: a legenda filtra (um clique esconde e mostra os dias desse intervalo)
        visualMap: {
          min: -scale,
          max: scale,
          pieces: [
            {
              min: -scale,
              max: -half,
              color: tint('cell-negative'),
              label: t('trading.fsCalendarPiece_bigLoss', { value: `${f.number(half)} ${unit}` }),
            },
            { min: -half, max: -flat, color: tint('cell-negative', TINT_SOFT), label: t('trading.fsCalendarPiece_loss') },
            { min: -flat, max: flat, color: token('cell-empty'), label: t('trading.fsCalendarPiece_flat') },
            { min: flat, max: half, color: tint('cell-positive', TINT_SOFT), label: t('trading.fsCalendarPiece_gain') },
            {
              min: half,
              max: scale,
              color: tint('cell-positive'),
              label: t('trading.fsCalendarPiece_bigGain', { value: `${f.number(half)} ${unit}` }),
            },
          ],
        },
        dayLabel: { names: weekdays },
        monthLabel: {
          names: [...Array(12)].map((_, month) => {
            const name = monthName.format(Date.UTC(2026, month, 1)).replace('.', '');
            return name.charAt(0).toUpperCase() + name.slice(1);
          }),
        },
        yearLabel: false,
        splitLine: false,
        cell: { radius: 3, gap: 3 },
        tooltip: {
          formatter: (cell) => {
            const datum = cell.datum as { pnl: number; trades: number; stops: number } | null;
            if (!datum) return '';
            const [y, month, day] = cell.key.split('-').map(Number);
            const date = dayName.format(Date.UTC(y, month - 1, day));
            return `<strong>${date}</strong><br>${t('trading.fsCalendarPnl')}: <strong>${f.money(datum.pnl)}</strong><br>${t('trading.fsCalendarTrades')}: <strong>${f.number(datum.trades)}</strong><br>${t('trading.fsCalendarStops')}: <strong>${f.number(datum.stops)}</strong>`;
          },
        },
        theme: calendarTheme,
        padding: 4,
        animation: { duration: 400 },
      });
    });
    return () => {
      cancelAnimationFrame(frame);
      chart?.destroy();
    };
    // f depende só da língua e da moeda
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [daily, year, t, i18n.language, unit, theme]);

  return (
    <Factsheet_Panel title={t('trading.fsCalendarTitle')} explain="hoursCalendar" note={t('trading.fsCalendarNote')} panelRef={rootRef}>
      {/* O ano por cima do calendário (no cabeçalho, a nota partia em duas linhas) */}
      <div className="Factsheet_Calendar_Years">
        {years.length > 1 && (
          <>
            <button
              type="button"
              className="Factsheet_Panel_Button Icon"
              aria-label={t('trading.fsCalendarPrevious')}
              title={t('trading.fsCalendarPrevious')}
              disabled={position <= 0}
              onClick={() => setChosen(years[position - 1])}
            >
              <Chevron_Left />
            </button>
            {years.length <= YEAR_BUTTONS ? (
              <Segmented
                value={String(year)}
                onChange={(value) => setChosen(Number(value))}
                label={t('trading.fsCalendarYear')}
                options={years.map((value) => ({ value: String(value), label: String(value) }))}
              />
            ) : (
              <span className="Factsheet_Calendar_Year">{year}</span>
            )}
            <button
              type="button"
              className="Factsheet_Panel_Button Icon"
              aria-label={t('trading.fsCalendarNext')}
              title={t('trading.fsCalendarNext')}
              disabled={position >= years.length - 1}
              onClick={() => setChosen(years[position + 1])}
            >
              <Chevron_Right />
            </button>
          </>
        )}
      </div>
      <div className="Factsheet_Chart Factsheet_Calendar" ref={chartRef} />
    </Factsheet_Panel>
  );
};

export default Factsheet_Calendar;

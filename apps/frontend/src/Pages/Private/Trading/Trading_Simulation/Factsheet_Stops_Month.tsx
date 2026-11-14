import { useEffect, useMemo, useRef } from 'react';
import { useTranslation } from 'react-i18next';
import { createBarChart } from 'openchartscandle/bar';
import type { BarTheme } from 'openchartscandle/bar';
import 'openchartscandle/style.css';
import { useTheme } from '../../../../Contexts/ThemeContext';
import type { Stops_By_Month } from '../../../../Hooks/Trading/useSimulation';
import { formatNumber } from '../Trading_Simulator/format';
import Factsheet_Panel from './Factsheet_Panel';
import { resolveToken } from './factsheetFormat';

interface Factsheet_Stops_Month_Props {
  chart: Stops_By_Month;
}

// A altura de cada barra das sequências (uma por N stops seguidos)
const STREAK_ROW_HEIGHT = 26;

/**
 * 4.3 — Stops por mês e sequências: uma barra por mês (UTC) com a média a
 * tracejado e, por baixo, quantas vezes houve N stops seguidos, em barras
 * deitadas com o número na ponta. Os dois são gráficos de barras da biblioteca.
 */
const Factsheet_Stops_Month = ({ chart: data }: Factsheet_Stops_Month_Props) => {
  const { t, i18n } = useTranslation();
  const language = i18n.language;
  const { theme } = useTheme();
  const rootRef = useRef<HTMLDivElement>(null);
  const monthsRef = useRef<HTMLDivElement>(null);
  const streaksRef = useRef<HTMLDivElement>(null);

  const month = useMemo(() => new Intl.DateTimeFormat(language, { month: 'short', year: 'numeric', timeZone: 'UTC' }), [language]);

  useEffect(() => {
    const monthsElement = monthsRef.current;
    const streaksElement = streaksRef.current;
    const root = rootRef.current;
    if (!monthsElement || !root) return;
    const charts: ReturnType<typeof createBarChart>[] = [];
    // Na frame seguinte: o data-theme do <html> muda depois deste efeito
    const frame = requestAnimationFrame(() => {
      const token = (name: string) => resolveToken(root, name);
      const barTheme: Partial<BarTheme> = {
        background: 'transparent',
        text: token('chart-text'),
        muted: token('chart-muted'),
        grid: token('chart-grid'),
        axis: token('chart-axis'),
        hover: token('chart-grid'),
        tooltipBg: token('chart-tooltip-background'),
        tooltipText: token('chart-tooltip-text'),
        tooltipBorder: token('chart-tooltip-border'),
        font: getComputedStyle(document.body).fontFamily,
      };
      const stopColor = token('exit-stop');

      charts.push(
        createBarChart(monthsElement, {
          categories: data.months.map(([time]) => month.format(new Date(time))),
          series: [{ id: 'stops', name: t('trading.fsStopsMonthStops'), data: data.months.map(([, stops]) => stops), color: stopColor }],
          theme: barTheme,
          padding: 4,
          categoryGap: 0.12,
          radius: 2,
          legend: { show: false },
          categoryAxis: { show: false, grid: false },
          valueAxis: { show: false, grid: false, min: 0 },
          annotations: data.avgPerMonth != null ? [{ value: data.avgPerMonth, color: token('chart-text'), dash: [4, 4] }] : [],
          tooltip: { mode: 'shared' },
          animation: { duration: 500 },
        }),
      );

      if (streaksElement && data.streaks.length) {
        charts.push(
          createBarChart(streaksElement, {
            categories: data.streaks.map((streak) => t('trading.fsStopsStreak', { count: streak.length })),
            series: [
              {
                id: 'streaks',
                name: t('trading.fsStopsStreakTimes'),
                data: data.streaks.map((streak) => streak.count),
                color: stopColor,
              },
            ],
            orientation: 'horizontal',
            theme: barTheme,
            padding: 4,
            categoryGap: 0.35,
            radius: 3,
            legend: { show: false },
            categoryAxis: { show: true, grid: false, ticks: false },
            valueAxis: { show: false, grid: false, min: 0 },
            labels: { show: true, position: 'outside', format: (value) => `${formatNumber(value, language, 0)}×` },
            tooltip: { mode: 'shared' },
            animation: { duration: 500 },
          }),
        );
      }
    });
    return () => {
      cancelAnimationFrame(frame);
      charts.forEach((chart) => chart.destroy());
    };
  }, [data, month, language, t, theme]);

  const first = data.months[0];
  const last = data.months[data.months.length - 1];

  return (
    <Factsheet_Panel title={t('trading.fsStopsMonthTitle')} explain="entryStopsMonth" note={t('trading.fsStopsMonthNote')} panelRef={rootRef}>
      <div className="Factsheet_Chart Stops_Month" ref={monthsRef} />
      <div className="Factsheet_Chart_Footer">
        <span>{first ? month.format(new Date(first[0])) : ''}</span>
        <span>{t('trading.fsStopsMonthAverage', { value: formatNumber(data.avgPerMonth ?? 0, language, 1) })}</span>
        <span>{last ? month.format(new Date(last[0])) : ''}</span>
      </div>
      {data.streaks.length > 0 && (
        <div className="Factsheet_Chart" ref={streaksRef} style={{ height: data.streaks.length * STREAK_ROW_HEIGHT + 12 }} />
      )}
    </Factsheet_Panel>
  );
};

export default Factsheet_Stops_Month;

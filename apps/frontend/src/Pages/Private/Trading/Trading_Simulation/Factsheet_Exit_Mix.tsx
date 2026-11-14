import { useEffect, useRef } from 'react';
import { useTranslation } from 'react-i18next';
import { createBarChart } from 'openchartscandle/bar';
import type { BarTheme } from 'openchartscandle/bar';
import 'openchartscandle/style.css';
import { useTheme } from '../../../../Contexts/ThemeContext';
import type { Entry_Payload, Exit_Column, Exit_Mix } from '../../../../Hooks/Trading/useSimulation';
import { entryLabel, exitColumnLabel } from '../Trading_Simulator/labels';
import Factsheet_Panel from './Factsheet_Panel';
import { exitColorToken, resolveToken, useFactsheetFormat } from './factsheetFormat';

interface Factsheet_Exit_Mix_Props {
  mix: Exit_Mix;
  columns: Exit_Column[];
  entries: Entry_Payload[];
}

// A altura de cada barra (uma por entrada) e o espaço da legenda por cima
const ROW_HEIGHT = 36;
const LEGEND_SPACE = 56;

/**
 * 4.2 — Como sai cada entrada: uma barra por entrada (`createBarChart`, deitada
 * e empilhada a 100%), dividida pela % dos trades que saiu por cada saída (as
 * colunas da matriz de cima). A legenda liga e desliga cada saída.
 */
const Factsheet_Exit_Mix = ({ mix, columns, entries }: Factsheet_Exit_Mix_Props) => {
  const { t } = useTranslation();
  const { theme } = useTheme();
  const f = useFactsheetFormat('');
  const rootRef = useRef<HTMLDivElement>(null);
  const chartRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    const element = chartRef.current;
    const root = rootRef.current;
    if (!element || !root) return;
    let chart: ReturnType<typeof createBarChart> | null = null;
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

      chart = createBarChart(element, {
        categories: mix.rows.map((row) => entryLabel(entries, row.rule, t)),
        series: columns.map((column, index) => ({
          id: column.key,
          name: exitColumnLabel(entries, column, t, f.language),
          data: mix.rows.map((row) => row.pct[index] ?? 0),
          color: token(exitColorToken(column.reason)),
        })),
        orientation: 'horizontal',
        stacked: 'percent',
        theme: barTheme,
        padding: 4,
        categoryGap: 0.35,
        radius: 2,
        legend: { show: true, position: 'top', align: 'start', marker: 'square', fontSize: 11.5 },
        categoryAxis: { show: true, grid: false, ticks: false },
        valueAxis: { show: false, grid: false, min: 0, max: 100 },
        tooltip: {
          mode: 'shared',
          total: false,
          formatter: (ctx) => {
            const parts = ctx.items
              .filter((item) => item.value > 0)
              .map((item) => `<span style="color:${item.color}">●</span> ${item.series.name}: <strong>${f.percent(item.value, 0)}</strong>`)
              .join('<br>');
            return `<strong>${ctx.category}</strong><br>${parts}`;
          },
        },
        animation: { duration: 500 },
      });
    });
    return () => {
      cancelAnimationFrame(frame);
      chart?.destroy();
    };
    // f depende só da língua
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [mix, columns, entries, t, f.language, theme]);

  return (
    <Factsheet_Panel title={t('trading.fsExitMixTitle')} explain="entryExitMix" note={t('trading.fsExitMixNote')} panelRef={rootRef}>
      <div className="Factsheet_Chart" ref={chartRef} style={{ height: mix.rows.length * ROW_HEIGHT + LEGEND_SPACE }} />
    </Factsheet_Panel>
  );
};

export default Factsheet_Exit_Mix;

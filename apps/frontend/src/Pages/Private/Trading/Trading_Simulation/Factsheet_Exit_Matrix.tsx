import { useEffect, useMemo, useRef } from 'react';
import { useTranslation } from 'react-i18next';
import { createHeatmapChart } from 'openchartscandle/heatmap';
import type { HeatmapDatum, HeatmapTheme } from 'openchartscandle/heatmap';
import 'openchartscandle/style.css';
import { useTheme } from '../../../../Contexts/ThemeContext';
import type { Entry_Exit_Matrix, Entry_Payload } from '../../../../Hooks/Trading/useSimulation';
import { entryLabel, exitColumnLabel } from '../Trading_Simulator/labels';
import Factsheet_Panel from './Factsheet_Panel';
import { resolveColor, resolveToken, useFactsheetFormat } from './factsheetFormat';

interface Factsheet_Exit_Matrix_Props {
  table: Entry_Exit_Matrix;
  entries: Entry_Payload[];
  unit: string;
}

// Como os retornos mensais (1.3): a altura de uma linha, o espaço dos nomes das
// saídas por baixo (rodam se não couberem) e o da legenda das cores, e a cor mais
// forte das células (em % da cor do token)
const ROW_HEIGHT = 32;
const AXIS_SPACE = 90;
const LEGEND_SPACE = 52;
const TINT_MAX = 55;

/**
 * 4.2 — Entrada → saída: um mapa de calor (`createHeatmapChart`) com uma linha
 * por entrada e uma coluna por saída. Cada célula diz os trades e a win rate; a
 * cor é o P&L médio (laranja a perder, azul a ganhar, numa escala simétrica à
 * volta do 0) e o tooltip dá o P&L total e o médio. Os tamanhos e a legenda das
 * cores, com pegas que filtram, são os dos retornos mensais (1.3).
 */
const Factsheet_Exit_Matrix = ({ table, entries, unit }: Factsheet_Exit_Matrix_Props) => {
  const { t } = useTranslation();
  const { theme } = useTheme();
  const f = useFactsheetFormat(unit);
  const rootRef = useRef<HTMLDivElement>(null);
  const chartRef = useRef<HTMLDivElement>(null);

  const shape = useMemo(() => {
    const data: HeatmapDatum[] = [];
    table.rows.forEach((row, y) =>
      row.cells.forEach((cell, x) => {
        if (cell) data.push({ x, y, value: cell.avgPnl, trades: cell.trades, winRatePct: cell.winRatePct, pnl: cell.pnl });
      }),
    );
    const largest = Math.max(...data.map((datum) => Math.abs(Number((datum as { value: number }).value))), 1);
    return { data, largest };
  }, [table]);

  useEffect(() => {
    const element = chartRef.current;
    const root = rootRef.current;
    if (!element || !root) return;
    let chart: ReturnType<typeof createHeatmapChart> | null = null;
    // Na frame seguinte: o data-theme do <html> muda depois deste efeito
    const frame = requestAnimationFrame(() => {
      const token = (name: string) => resolveToken(root, name);
      const tint = (name: string) =>
        resolveColor(root, `color-mix(in srgb, var(--factsheet-${name}) ${TINT_MAX}%, var(--factsheet-cell-empty))`);
      const heatTheme: Partial<HeatmapTheme> = {
        background: 'transparent',
        text: token('returns-header'),
        muted: token('chart-muted'),
        axis: token('chart-axis'),
        cell: token('cell-empty'),
        emphasis: token('chart-grid'),
        tooltipBg: token('chart-tooltip-background'),
        tooltipText: token('chart-tooltip-text'),
        tooltipBorder: token('chart-tooltip-border'),
        font: getComputedStyle(element).fontFamily,
      };

      chart = createHeatmapChart(element, {
        xAxis: { data: table.columns.map((column) => exitColumnLabel(entries, column, t, f.language)), fontSize: 11.5 },
        yAxis: { data: table.rows.map((row) => entryLabel(entries, row.rule, t)), inverse: true, fontSize: 11.5 },
        data: shape.data,
        visualMap: {
          min: -shape.largest,
          max: shape.largest,
          colors: [tint('cell-negative'), token('cell-empty'), tint('cell-positive')],
          format: (value) => f.money(value, 0),
        },
        cell: { gap: 3, radius: 4, emptyColor: 'transparent' },
        label: {
          color: token('value'),
          fontSize: 12,
          format: (_, cell) => {
            const datum = cell.datum as { trades: number; winRatePct: number | null } | null;
            return datum ? `${f.number(datum.trades)} · ${f.percent(datum.winRatePct, 0)}` : '';
          },
        },
        tooltip: {
          formatter: (cell) => {
            const datum = cell.datum as { trades: number; winRatePct: number | null; pnl: number } | null;
            if (!datum) return '';
            return `<strong>${cell.yName} → ${cell.xName}</strong><br>${t('trading.fsMatrixTrades')}: <strong>${f.number(datum.trades)}</strong><br>${t('trading.fsMatrixWinRate')}: <strong>${f.percent(datum.winRatePct, 0)}</strong><br>${t('trading.fsMatrixPnl')}: <strong>${f.money(datum.pnl)}</strong><br>${t('trading.fsMatrixAvgPnl')}: <strong>${f.money(cell.value, 2)}</strong>`;
          },
        },
        theme: heatTheme,
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
  }, [shape, table, entries, t, f.language, unit, theme]);

  return (
    <Factsheet_Panel title={t('trading.fsMatrixTitle')} explain="entryMatrix" note={t('trading.fsMatrixNote')} panelRef={rootRef}>
      <div
        className="Factsheet_Chart Factsheet_Heatmap"
        ref={chartRef}
        style={{ height: table.rows.length * ROW_HEIGHT + AXIS_SPACE + LEGEND_SPACE }}
      />
    </Factsheet_Panel>
  );
};

export default Factsheet_Exit_Matrix;

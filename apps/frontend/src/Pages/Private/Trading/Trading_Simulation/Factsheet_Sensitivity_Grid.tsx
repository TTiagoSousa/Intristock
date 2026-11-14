import { useEffect, useRef } from 'react';
import { useTranslation } from 'react-i18next';
import { createHeatmapChart } from 'openchartscandle/heatmap';
import type { HeatmapDatum, HeatmapTheme } from 'openchartscandle/heatmap';
import 'openchartscandle/style.css';
import { useTheme } from '../../../../Contexts/ThemeContext';
import type { Entry_Payload, Sensitivity_Grid } from '../../../../Hooks/Trading/useSimulation';
import Factsheet_Panel from './Factsheet_Panel';
import { resolveColor, resolveToken } from './factsheetFormat';
import { useVerdictFormat } from './verdictFormat';

interface Factsheet_Sensitivity_Grid_Props {
  grid: Sensitivity_Grid;
  entries: Entry_Payload[];
  unit: string;
}

// A altura do mapa e a cor mais forte das células (em % da cor do token)
const HEIGHT = 330;
const TINT_MAX = 70;

/**
 * 3.4 — O mapa dos dois parâmetros que mais mexem no resultado, cada um de
 * ×0,8 a ×1,2: o retorno de cada combinação (`createHeatmapChart`, laranja a
 * perder, azul a ganhar, numa escala simétrica), com a atual ao centro. Uma
 * zona larga da mesma cor é robusta; um pico isolado é ajuste ao passado. Tudo
 * vem calculado pelo simulador.
 */
const Factsheet_Sensitivity_Grid = ({ grid, entries, unit }: Factsheet_Sensitivity_Grid_Props) => {
  const { t, i18n } = useTranslation();
  const { theme } = useTheme();
  const { f, paramLabel, paramValue } = useVerdictFormat(entries, unit);
  const rootRef = useRef<HTMLDivElement>(null);
  const chartRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    const element = chartRef.current;
    const root = rootRef.current;
    if (!element || !root || !grid.cells || !grid.x || !grid.y) return;
    const { x, y, cells } = grid;
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
      const largest = Math.max(1, ...cells.flat().map((cell) => Math.abs(cell.returnPct)));
      const data: HeatmapDatum[] = cells.flatMap((line, row) =>
        line.map((cell, column) => ({ x: column, y: row, value: cell.returnPct, cell })),
      );

      chart = createHeatmapChart(element, {
        xAxis: { data: (grid.xValues ?? []).map((value) => paramValue(x, value)), name: paramLabel(x), fontSize: 11.5 },
        yAxis: { data: (grid.yValues ?? []).map((value) => paramValue(y, value)), name: paramLabel(y), fontSize: 11.5 },
        data,
        visualMap: {
          min: -largest,
          max: largest,
          colors: [tint('cell-negative'), token('cell-empty'), tint('cell-positive')],
          format: (value) => f.signedPercent(value, 0),
        },
        cell: { gap: 3, radius: 4 },
        label: { color: token('value'), fontSize: 12, format: (value) => f.signedPercent(value, 1) },
        tooltip: {
          formatter: (cell) => {
            const own = (cell.datum as { cell: { returnPct: number; outReturnPct: number | null; trades: number; maxDrawdownPct: number } } | null)?.cell;
            if (!own) return '';
            return `<strong>${paramLabel(x)} ${cell.xName} · ${paramLabel(y)} ${cell.yName}</strong><br>${t('trading.fsFiltersCol_return')}: <strong>${f.signedPercent(own.returnPct, 1)}</strong><br>${t('trading.fsFiltersCol_outside')}: <strong>${f.signedPercent(own.outReturnPct, 1)}</strong><br>${t('trading.fsFiltersCol_maxDd')}: <strong>${f.signedPercent(own.maxDrawdownPct, 1)}</strong><br>${t('trading.fsHourCol_trades')}: <strong>${f.number(own.trades)}</strong>`;
          },
        },
        emphasis: 'cross',
        theme: heatTheme,
        padding: 4,
        animation: { duration: 400 },
      });
    });
    return () => {
      cancelAnimationFrame(frame);
      chart?.destroy();
    };
    // Os formatos dependem só da língua
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [grid, t, i18n.language, theme]);

  return (
    <Factsheet_Panel title={t('trading.fsSensGridTitle')} explain="proofSensGrid" note={t('trading.fsSensGridNote')} panelRef={rootRef}>
      <div className="Factsheet_Chart Factsheet_Heatmap" ref={chartRef} style={{ height: HEIGHT }} />
    </Factsheet_Panel>
  );
};

export default Factsheet_Sensitivity_Grid;

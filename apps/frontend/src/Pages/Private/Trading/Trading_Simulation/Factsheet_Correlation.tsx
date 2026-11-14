import { useEffect, useRef } from 'react';
import { useTranslation } from 'react-i18next';
import { createHeatmapChart } from 'openchartscandle/heatmap';
import type { HeatmapTheme } from 'openchartscandle/heatmap';
import 'openchartscandle/style.css';
import { useTheme } from '../../../../Contexts/ThemeContext';
import type { Entry_Correlation, Entry_Payload } from '../../../../Hooks/Trading/useSimulation';
import { entryLabel } from '../Trading_Simulator/labels';
import Factsheet_Panel from './Factsheet_Panel';
import { resolveColor, resolveToken, useFactsheetFormat } from './factsheetFormat';

interface Factsheet_Correlation_Props {
  table: Entry_Correlation;
  entries: Entry_Payload[];
}

// Como os retornos mensais (1.3): a altura de uma linha, o espaço dos nomes por
// baixo (direitos até 4 entradas; com mais rodam e precisam de mais) e o da
// legenda das cores, e a cor mais forte das células (em % da cor do token)
const ROW_HEIGHT = 32;
const AXIS_SPACE = 28;
const ROTATED_AXIS_SPACE = 90;
const STRAIGHT_NAMES = 4;
const LEGEND_SPACE = 52;
const TINT_MAX = 55;

/**
 * 4.6 — Correlação entre entradas: a do P&L semanal de cada par, num mapa de
 * calor (`createHeatmapChart`) de −1 (laranja) a 1 (azul), com o valor em cada
 * célula. A matriz vem calculada. Os tamanhos e a legenda das cores, com pegas
 * que filtram, são os dos retornos mensais (1.3).
 */
const Factsheet_Correlation = ({ table, entries }: Factsheet_Correlation_Props) => {
  const { t } = useTranslation();
  const { theme } = useTheme();
  const f = useFactsheetFormat('');
  const rootRef = useRef<HTMLDivElement>(null);
  const chartRef = useRef<HTMLDivElement>(null);

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
      const names = table.rules.map((rule) => entryLabel(entries, rule, t));

      chart = createHeatmapChart(element, {
        xAxis: { data: names, fontSize: 11.5 },
        yAxis: { data: names, inverse: true, fontSize: 11.5 },
        matrix: table.matrix,
        visualMap: {
          min: -1,
          max: 1,
          colors: [tint('cell-negative'), token('cell-empty'), tint('cell-positive')],
          format: (value) => f.number(value, 2),
        },
        cell: { gap: 3, radius: 4, emptyColor: 'transparent' },
        label: { format: (value) => f.number(value, 2), color: token('value'), fontSize: 12 },
        tooltip: {
          formatter: (cell) =>
            `<strong>${cell.yName} × ${cell.xName}</strong><br>${t('trading.fsCorrelationValue')}: <strong>${f.number(cell.value, 2)}</strong>`,
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
    // f depende só da língua
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [table, entries, t, f.language, theme]);

  return (
    <Factsheet_Panel title={t('trading.fsCorrelationTitle')} explain="entryCorrelation" note={t('trading.fsCorrelationNote')} panelRef={rootRef}>
      <div
        className="Factsheet_Chart Factsheet_Heatmap"
        ref={chartRef}
        style={{
          height:
            table.rules.length * ROW_HEIGHT +
            (table.rules.length > STRAIGHT_NAMES ? ROTATED_AXIS_SPACE : AXIS_SPACE) +
            LEGEND_SPACE,
        }}
      />
    </Factsheet_Panel>
  );
};

export default Factsheet_Correlation;

import { useEffect, useMemo, useRef } from 'react';
import { useTranslation } from 'react-i18next';
import { createHeatmapChart } from 'openchartscandle/heatmap';
import type { HeatmapDatum, HeatmapTheme } from 'openchartscandle/heatmap';
import 'openchartscandle/style.css';
import { useTheme } from '../../../../Contexts/ThemeContext';
import Factsheet_Panel from './Factsheet_Panel';
import { hourLabel, resolveColor, resolveToken } from './factsheetFormat';

// Uma célula com trades: o valor da cor e o texto dela. Sem valor (`null`), fica
// na cor de base com o texto (ex.: "-", trades sem stops)
export interface Day_Hour_Cell {
  value: number | null;
  text: string;
  // Amostra pequena (poucos trades): a cor fica esbatida
  faded?: boolean;
}

interface Factsheet_Day_Hour_Grid_Props {
  title: string;
  // A explicação do \"?\" (trading.fsExplain_<explain>_*)
  explain?: string;
  note: string;
  // 7 linhas (0 = segunda) × 24 horas; nulo = sem trades (célula vazia)
  cells: (Day_Hour_Cell | null)[][];
  // A escala das cores: do mínimo ao máximo, os tokens (`--factsheet-<token>`;
  // `null` = a cor de base das células)
  min: number;
  max: number;
  colors: (string | null)[];
  // O texto da legenda das cores
  format: (value: number) => string;
  // O tooltip de uma célula com trades (HTML)
  tooltip: (day: number, hour: number) => string;
}

// A altura de uma linha, o espaço das horas por baixo e o da legenda das cores,
// e a cor mais forte das células (em % da cor do token)
const ROW_HEIGHT = 30;
const AXIS_SPACE = 28;
const LEGEND_SPACE = 40;
const TINT_MAX = 70;
// A cor das células de amostra pequena (em % da cor do token)
const TINT_FADED = 20;

/**
 * 5.4 — Um mapa de calor (`createHeatmapChart`) dia da semana × hora de
 * entrada: 7 linhas (Seg a Dom) e 24 colunas, com o texto em cada célula e a
 * legenda das cores, com pegas que filtram. Os quatro mapas da secção são este,
 * com o mesmo quadriculado; os valores, os textos e as cores vêm de quem o usa,
 * tudo já calculado pelo simulador.
 */
const Factsheet_Day_Hour_Grid = ({ title, note, explain, cells, min, max, colors, format, tooltip }: Factsheet_Day_Hour_Grid_Props) => {
  const { t, i18n } = useTranslation();
  const { theme } = useTheme();
  const rootRef = useRef<HTMLDivElement>(null);
  const chartRef = useRef<HTMLDivElement>(null);
  const tooltipRef = useRef(tooltip);
  const formatRef = useRef(format);
  useEffect(() => {
    tooltipRef.current = tooltip;
    formatRef.current = format;
  });

  const data = useMemo(() => {
    const list: HeatmapDatum[] = [];
    cells.forEach((row, y) =>
      row.forEach((cell, x) => {
        if (cell) list.push({ x, y, value: cell.value, text: cell.text, faded: cell.faded });
      }),
    );
    return list;
  }, [cells]);

  useEffect(() => {
    const element = chartRef.current;
    const root = rootRef.current;
    if (!element || !root) return;
    let chart: ReturnType<typeof createHeatmapChart> | null = null;
    // Na frame seguinte: o data-theme do <html> muda depois deste efeito
    const frame = requestAnimationFrame(() => {
      const token = (name: string) => resolveToken(root, name);
      const tint = (name: string | null) =>
        name
          ? resolveColor(root, `color-mix(in srgb, var(--factsheet-${name}) ${TINT_MAX}%, var(--factsheet-cell-empty))`)
          : token('cell-empty');
      const heatTheme: Partial<HeatmapTheme> = {
        background: 'transparent',
        text: token('returns-header'),
        muted: token('chart-muted'),
        axis: token('chart-axis'),
        cell: token('grid-none'),
        emphasis: token('chart-grid'),
        tooltipBg: token('chart-tooltip-background'),
        tooltipText: token('chart-tooltip-text'),
        tooltipBorder: token('chart-tooltip-border'),
        font: getComputedStyle(element).fontFamily,
      };
      const base = token('cell-empty');

      chart = createHeatmapChart(element, {
        xAxis: { data: Array.from({ length: 24 }, (_, hour) => hourLabel(hour)), fontSize: 11 },
        yAxis: { data: cells.map((_, day) => t(`trading.fsWeekdayShort_${day}`)), inverse: true, fontSize: 11.5 },
        // As células sem valor ficam na cor de base, com o texto: o valor só serve para a etiqueta aparecer.
        // Fora da escala, a cor da ponta (a legenda esconderia a célula); o texto continua o valor real
        data: data.map((datum) => {
          const cell = datum as { x: number; y: number; value: number | null; text: string; faded?: boolean };
          if (cell.value == null) return { ...cell, value: min, color: base };
          const value = Math.min(max, Math.max(min, cell.value));
          if (!cell.faded) return { ...cell, value };
          // Esbatida: a cor do lado do valor (a ponta da escala), bem misturada no fundo
          const side = colors.length > 2 ? (value < (min + max) / 2 ? colors[0] : colors[colors.length - 1]) : colors[colors.length - 1];
          const color = side
            ? resolveColor(root, `color-mix(in srgb, var(--factsheet-${side}) ${TINT_FADED}%, var(--factsheet-cell-empty))`)
            : base;
          return { ...cell, value, color };
        }),
        visualMap: { min, max, colors: colors.map(tint), format: (value) => formatRef.current(value) },
        cell: { gap: 3, radius: 4 },
        label: {
          color: token('value'),
          fontSize: 11,
          format: (_, cell) => (cell.datum as { text?: string } | null)?.text ?? '',
        },
        emphasis: 'cell',
        tooltip: { formatter: (cell) => (cell.datum ? tooltipRef.current(cell.y, cell.x) : '') },
        theme: heatTheme,
        padding: 4,
        animation: { duration: 400 },
      });
    });
    return () => {
      cancelAnimationFrame(frame);
      chart?.destroy();
    };
    // O mapa refaz-se com os dados, a escala, a língua e o tema
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [data, min, max, colors, t, i18n.language, theme]);

  return (
    <Factsheet_Panel title={title} note={note} explain={explain} panelRef={rootRef}>
      <div
        className="Factsheet_Chart Factsheet_Heatmap"
        ref={chartRef}
        style={{ height: cells.length * ROW_HEIGHT + AXIS_SPACE + LEGEND_SPACE }}
      />
    </Factsheet_Panel>
  );
};

export default Factsheet_Day_Hour_Grid;

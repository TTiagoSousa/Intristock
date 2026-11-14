import { useEffect, useRef, useState } from 'react';
import { useTranslation } from 'react-i18next';
import { createHeatmapChart } from 'openchartscandle/heatmap';
import type { HeatmapDatum, HeatmapTheme } from 'openchartscandle/heatmap';
import 'openchartscandle/style.css';
import { useTheme } from '../../../../Contexts/ThemeContext';
import { formatNumber } from '../Trading_Simulator/format';
import { resolveColor, resolveToken } from './factsheetFormat';

// Uma célula: a coluna e a linha (índices), o retorno em % e se o período é parcial
export interface Returns_Cell {
  x: number;
  y: number;
  pct: number;
  partial: boolean;
}

interface Factsheet_Returns_Grid_Props {
  columns: string[];
  // Os anos (ou uma linha sem nome, na vista por ano)
  rows: string[];
  cells: Returns_Cell[];
  // Até onde vai a cor (em %, nos dois sentidos): os meses ou trimestres da vista;
  // os anos maiores ficam na cor mais forte
  scale: number;
}

// A altura de uma linha (como as da tabela de antes) e o espaço dos nomes das
// colunas e da legenda das cores por baixo
const ROW_HEIGHT = 32;
const AXIS_SPACE = 28;
const LEGEND_SPACE = 52;
// A cor mais forte das células (em % da cor do token), como na tabela de antes
const TINT_MAX = 55;

interface Box {
  key: string;
  x: number;
  y: number;
  w: number;
  h: number;
}

/**
 * 1.3 — A grelha dos retornos: um mapa de calor (`createHeatmapChart`) com o
 * retorno em cada célula, azul a subir e laranja a descer numa escala só,
 * simétrica à volta do 0 (até ao maior mês ou trimestre da vista). A legenda das cores, por baixo, tem pegas que deixam
 * ver só os períodos dentro de um intervalo. Os parciais levam um contorno
 * tracejado por cima (a biblioteca não tem contorno por célula).
 */
const Factsheet_Returns_Grid = ({ columns, rows, cells, scale }: Factsheet_Returns_Grid_Props) => {
  const { t, i18n } = useTranslation();
  const language = i18n.language;
  const { theme } = useTheme();
  const chartRef = useRef<HTMLDivElement>(null);
  const [partials, setPartials] = useState<Box[]>([]);

  useEffect(() => {
    const element = chartRef.current;
    if (!element) return;
    let chart: ReturnType<typeof createHeatmapChart> | null = null;
    let observer: ResizeObserver | null = null;
    let measure = 0;
    const percent = (value: number) =>
      `${value > 0 ? '+' : value < 0 ? '−' : ''}${formatNumber(Math.abs(value), language, 1)}%`;

    // Onde estão as células parciais, para o contorno (muda com o tamanho)
    const placePartials = () => {
      cancelAnimationFrame(measure);
      measure = requestAnimationFrame(() => {
        if (!chart) return;
        setPartials(
          cells
            .filter((cell) => cell.partial)
            .flatMap((cell) => {
              const found = chart?.cellAt(cell.x, cell.y);
              return found ? [{ key: `${cell.x}-${cell.y}`, ...found.box }] : [];
            }),
        );
      });
    };

    // Na frame seguinte: o data-theme do <html> muda depois deste efeito
    const frame = requestAnimationFrame(() => {
      const token = (name: string) => resolveToken(element, name);
      const tint = (name: string) =>
        resolveColor(element, `color-mix(in srgb, var(--factsheet-${name}) ${TINT_MAX}%, var(--factsheet-returns-empty))`);
      const heatTheme: Partial<HeatmapTheme> = {
        background: 'transparent',
        text: token('returns-header'),
        muted: token('chart-muted'),
        axis: token('chart-axis'),
        cell: token('returns-empty'),
        emphasis: token('chart-grid'),
        tooltipBg: token('chart-tooltip-background'),
        tooltipText: token('chart-tooltip-text'),
        tooltipBorder: token('chart-tooltip-border'),
        font: getComputedStyle(element).fontFamily,
      };
      // A cor vai até à escala (o valor limitado a ela, senão a legenda escondia a
      // célula); o texto e o tooltip dão o retorno verdadeiro (`pct`)
      const data: HeatmapDatum[] = cells.map((cell) => ({
        x: cell.x,
        y: cell.y,
        value: Math.max(-scale, Math.min(scale, cell.pct)),
        pct: cell.pct,
        partial: cell.partial,
      }));
      const pctOf = (datum: unknown) => (datum as { pct: number } | null)?.pct ?? 0;

      chart = createHeatmapChart(element, {
        xAxis: { data: columns, rotate: 0, fontSize: 11.5 },
        yAxis: { data: rows, inverse: true, fontSize: 11.5, show: rows.some(Boolean) },
        data,
        visualMap: {
          min: -scale,
          max: scale,
          colors: [tint('returns-negative'), token('returns-empty'), tint('returns-positive')],
          format: percent,
        },
        cell: { gap: 3, radius: 4, emptyColor: 'transparent' },
        label: { format: (_, cell) => percent(pctOf(cell.datum)), color: token('value'), fontSize: 12 },
        tooltip: {
          formatter: (cell) => {
            const partial = (cell.datum as { partial?: boolean } | null)?.partial;
            const name = [cell.yName, cell.xName].filter(Boolean).join(' · ');
            return `<strong>${name}</strong><br>${percent(pctOf(cell.datum))}${partial ? `<br>${t('trading.fsReturnsPartial')}` : ''}`;
          },
        },
        theme: heatTheme,
        padding: 4,
        animation: { duration: 400 },
      });
      placePartials();
      observer = new ResizeObserver(placePartials);
      observer.observe(element);
    });
    return () => {
      cancelAnimationFrame(frame);
      cancelAnimationFrame(measure);
      observer?.disconnect();
      chart?.destroy();
    };
  }, [columns, rows, cells, scale, language, t, theme]);

  return (
    <div className="Factsheet_Returns_Grid">
      <div
        className="Factsheet_Chart Factsheet_Heatmap"
        ref={chartRef}
        style={{ height: rows.length * ROW_HEIGHT + AXIS_SPACE + LEGEND_SPACE }}
      />
      {partials.map((box) => (
        <span
          key={box.key}
          className="Factsheet_Returns_Partial"
          style={{ left: box.x, top: box.y, width: box.w, height: box.h }}
        />
      ))}
    </div>
  );
};

export default Factsheet_Returns_Grid;

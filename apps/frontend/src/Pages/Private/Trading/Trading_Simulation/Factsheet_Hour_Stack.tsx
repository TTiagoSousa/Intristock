import { useEffect, useRef } from 'react';
import { createBarChart } from 'openchartscandle/bar';
import type { BarTheme } from 'openchartscandle/bar';
import 'openchartscandle/style.css';
import { useTheme } from '../../../../Contexts/ThemeContext';
import Factsheet_Panel from './Factsheet_Panel';
import { hourLabel, resolveToken, useFactsheetFormat } from './factsheetFormat';

// Uma parte das colunas: os trades de uma entrada ou de um motivo de saída em cada hora
export interface Hour_Stack_Series {
  id: string;
  name: string;
  counts: number[];
  // O token da cor (`--factsheet-<token>`)
  colorToken: string;
}

interface Factsheet_Hour_Stack_Props {
  title: string;
  // A explicação do \"?\" (trading.fsExplain_<explain>_*)
  explain?: string;
  note: string;
  series: Hour_Stack_Series[];
  // As colunas (por omissão as 24 horas) e a classe da altura
  categories?: string[];
  size?: string;
}

/**
 * 5.1, 5.2 e 5.3 — Uma coluna por hora (ou por dia da semana) com os trades empilhados (por entrada ou por
 * motivo de saída) e o total por cima, só das partes à vista: a legenda liga e
 * desliga cada uma.
 */
const HOURS = Array.from({ length: 24 }, (_, hour) => hourLabel(hour));

const Factsheet_Hour_Stack = ({ title, note, explain, series, categories = HOURS, size = 'Hour_Stack' }: Factsheet_Hour_Stack_Props) => {
  const { theme } = useTheme();
  const rootRef = useRef<HTMLDivElement>(null);
  const chartRef = useRef<HTMLDivElement>(null);
  const f = useFactsheetFormat('');

  useEffect(() => {
    const element = chartRef.current;
    const root = rootRef.current;
    if (!element || !root) return;
    let chart: ReturnType<typeof createBarChart> | null = null;
    let off: (() => void) | null = null;
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
      const shown = series.filter((part) => part.counts.some(Boolean));
      const hidden = new Set<string>();
      // Os números na letra mono, como nas tabelas do relatório
      const mono = "'IBM Plex Sans', system-ui, sans-serif";

      chart = createBarChart(element, {
        categories,
        series: shown.map((part) => ({
          id: part.id,
          name: part.name,
          data: part.counts,
          color: token(part.colorToken),
          stack: 'trades',
        })),
        stacked: true,
        theme: barTheme,
        padding: 4,
        categoryGap: 0.18,
        radius: 2,
        legend: { show: true, position: 'top', align: 'start', marker: 'square', fontSize: 11.5 },
        categoryAxis: { show: true, grid: false, ticks: false },
        valueAxis: { show: false, grid: false, min: 0 },
        tooltip: { mode: 'shared', total: true },
        animation: { duration: 500 },
        // O total de cada hora por cima da coluna (das partes à vista)
        graphic: (ctx, api) => {
          ctx.save();
          ctx.fillStyle = barTheme.text ?? '';
          ctx.font = `600 10.5px ${mono}`;
          ctx.textAlign = 'center';
          ctx.textBaseline = 'bottom';
          for (let hour = 0; hour < categories.length; hour += 1) {
            const total = shown.reduce((sum, part) => sum + (hidden.has(part.id) ? 0 : part.counts[hour]), 0);
            if (total > 0) ctx.fillText(f.number(total), api.category(hour), api.value(total) - 4);
          }
          ctx.restore();
        },
      });
      off = chart.on('toggle', ({ id, hidden: isHidden }) => {
        if (isHidden) hidden.add(id);
        else hidden.delete(id);
      });
    });
    return () => {
      cancelAnimationFrame(frame);
      off?.();
      chart?.destroy();
    };
    // f.number depende só da língua
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [series, categories, f.language, theme]);

  return (
    <Factsheet_Panel title={title} note={note} explain={explain} panelRef={rootRef}>
      <div className={`Factsheet_Chart ${size}`} ref={chartRef} />
    </Factsheet_Panel>
  );
};

export default Factsheet_Hour_Stack;

import { useEffect, useRef } from 'react';
import { createLineChart } from 'openchartscandle/line';
import type { LineTheme } from 'openchartscandle/line';
import 'openchartscandle/style.css';
import { useTheme } from '../../../../Contexts/ThemeContext';
import { resolveColor } from '../../../../Components/Charts/resolveColor';

export interface Portfolio_Chart_Series {
  id: string;
  name: string;
  // Um valor por ponto, na ordem de `days`
  values: number[];
  // O token CSS da cor (`portfolio-chart-line-1`)
  colorToken: string;
  dashed?: boolean;
}

interface Portfolio_Chart_Props {
  // Os dias dos pontos, YYYY-MM-DD
  days: string[];
  series: Portfolio_Chart_Series[];
  format: (value: number) => string;
  compact: (value: number) => string;
  dateLabel: (ms: number) => string;
  // A data curta do eixo
  axisLabel: (ms: number) => string;
}

const escape = (text: string) =>
  text.replace(/[&<>"]/g, (char) => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;' })[char] ?? char);

/**
 * O valor dos portefólios no tempo, nas linhas da `trading-chart`, um ponto por
 * dia com transações. Ocupa a altura que o pai lhe der.
 */
const Portfolio_Chart = ({ days, series, format, compact, dateLabel, axisLabel }: Portfolio_Chart_Props) => {
  const { theme } = useTheme();
  const chartRef = useRef<HTMLDivElement>(null);
  const latest = useRef({ format, compact, dateLabel, axisLabel });
  useEffect(() => {
    latest.current = { format, compact, dateLabel, axisLabel };
  });
  const dataKey = JSON.stringify({ days, series });

  useEffect(() => {
    const element = chartRef.current;
    if (!element) return;
    let chart: ReturnType<typeof createLineChart> | null = null;
    // Na frame seguinte: o data-theme do <html> muda depois deste efeito
    const frame = requestAnimationFrame(() => {
      const token = (name: string) => resolveColor(element, `var(--${name})`);
      const look: Partial<LineTheme> = {
        background: 'transparent',
        text: token('month-chart-text'),
        muted: token('month-chart-muted'),
        grid: token('month-chart-grid'),
        axis: token('month-chart-axis'),
        crosshair: token('month-chart-muted'),
        tooltipBg: token('month-chart-tooltip-background'),
        tooltipText: token('month-chart-tooltip-text'),
        tooltipBorder: token('month-chart-tooltip-border'),
        font: getComputedStyle(document.body).fontFamily,
      };
      const times = days.map((day) => Date.parse(`${day}T00:00:00Z`));
      const colors = series.map((part) => token(part.colorToken));
      // Com uma só linha, a área por baixo; com várias, só as linhas
      const single = series.length === 1;

      chart = createLineChart(element, {
        xType: 'time',
        curve: 'linear',
        series: series.map((part, position) => ({
          id: part.id,
          name: part.name,
          data: part.values.map((y, index) => ({ x: times[index], y })),
          color: colors[position],
          width: part.dashed ? 1.5 : 2,
          dash: part.dashed ? [5, 4] : undefined,
          area: single ? { opacity: 0.12 } : false,
        })),
        theme: look,
        padding: 4,
        legend: { show: !single, position: 'bottom', align: 'center', marker: 'line', fontSize: 11 },
        yAxis: { grid: true, beginAtZero: true, format: (value) => latest.current.compact(value) },
        // Só datas: o dinheiro conta-se ao dia
        xAxis: { grid: false, format: (x) => latest.current.axisLabel(x < 1e11 ? x * 1000 : x) },
        crosshair: { show: true },
        tooltip: {
          mode: 'shared',
          formatter: (ctx) => {
            const rows = ctx.points
              .map((point) => `<span style="color:${point.color}">●</span> ${escape(point.series.name)}: <strong>${latest.current.format(point.y)}</strong>`)
              .join('<br>');
            return `<strong>${latest.current.dateLabel(ctx.x < 1e11 ? ctx.x * 1000 : ctx.x)}</strong><br>${rows}`;
          },
        },
        animation: { duration: 450 },
      });
    });
    return () => {
      cancelAnimationFrame(frame);
      chart?.destroy();
    };
    // O gráfico refaz-se com os dados e o tema
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [dataKey, theme]);

  return <div className="Portfolio_Chart" ref={chartRef} />;
};

export default Portfolio_Chart;

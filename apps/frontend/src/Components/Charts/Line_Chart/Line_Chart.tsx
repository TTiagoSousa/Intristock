import { useEffect, useRef } from 'react';
import { createLineChart } from 'openchartscandle/line';
import type { LineTheme } from 'openchartscandle/line';
import 'openchartscandle/style.css';
import { useTheme } from '../../../Contexts/ThemeContext';
import { resolveColor } from '../resolveColor';
import './Line_Chart.scss';

export interface LineSeries {
  dataKey: string;
  name: string;
  // A cor, em CSS (`var(--token)`)
  color: string;
  dashed?: boolean;
}

interface LineDataPoint {
  period: number | string;
  [key: string]: number | string;
}

interface Props {
  title: string;
  subtitle?: string;
  data: LineDataPoint[];
  series: LineSeries[];
  formatValue?: (value: number) => string;
}

const escape = (text: string) =>
  text.replace(/[&<>"]/g, (char) => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;' })[char] ?? char);

/**
 * Um gráfico de linhas simples da `trading-chart` (o dos juros compostos): um
 * ponto por período, uma linha por série. Refaz-se quando os dados ou o tema mudam.
 */
const Line_Chart = ({ title, subtitle, data, series, formatValue }: Props) => {
  const { theme } = useTheme();
  const chartRef = useRef<HTMLDivElement>(null);
  // O formatador mais recente, sem refazer o gráfico a cada render
  const latest = useRef({ data, series, formatValue });
  useEffect(() => {
    latest.current = { data, series, formatValue };
  });
  const dataKey = JSON.stringify({ data, series });

  useEffect(() => {
    const element = chartRef.current;
    if (!element) return;
    let chart: { destroy: () => void } | null = null;
    // Na frame seguinte: o data-theme do <html> muda depois deste efeito
    const frame = requestAnimationFrame(() => {
      const current = latest.current;
      const token = (name: string) => resolveColor(element, `var(--${name})`);
      const look = {
        background: 'transparent',
        text: token('line-chart-text'),
        muted: token('line-chart-muted'),
        grid: token('line-chart-grid'),
        axis: token('line-chart-axis'),
        tooltipBg: token('line-chart-tooltip-background'),
        tooltipText: token('line-chart-tooltip-text'),
        tooltipBorder: token('line-chart-tooltip-border'),
        crosshair: token('line-chart-muted'),
        font: getComputedStyle(document.body).fontFamily,
      };
      const colors = current.series.map((part) => resolveColor(element, part.color));
      const format = (value: number) => (current.formatValue ? current.formatValue(value) : String(value));
      const categories = current.data.map((point) => String(point.period));

      const tooltip = (index: number) => {
        const point = current.data[index];
        if (!point) return '';
        const rows = current.series
          .map(
            (part, position) =>
              `<div class="LC_Tooltip_Row"><span class="LC_Tooltip_Dot" style="background:${colors[position]}"></span>` +
              `<span class="LC_Tooltip_Name">${escape(part.name)}</span>` +
              `<span class="LC_Tooltip_Value">${escape(format(Number(point[part.dataKey]) || 0))}</span></div>`,
          )
          .join('');
        return `<div class="LC_Tooltip"><span class="LC_Tooltip_Label">${escape(categories[index] ?? '')}</span>${rows}</div>`;
      };

      chart = createLineChart(element, {
        categories,
        xType: 'category',
        series: current.series.map((part, position) => ({
          id: part.dataKey,
          name: part.name,
          data: current.data.map((point) => {
            const value = Number(point[part.dataKey]);
            return Number.isFinite(value) ? value : null;
          }),
          color: colors[position],
          dash: part.dashed ? [4, 4] : undefined,
        })),
        curve: 'smooth',
        theme: look as Partial<LineTheme>,
        padding: 4,
        legend: { show: true, position: 'bottom', align: 'center', marker: 'line', fontSize: 11 },
        yAxis: { grid: true },
        xAxis: { grid: false },
        tooltip: { mode: 'shared', formatter: (ctx) => tooltip(ctx.x) },
        animation: { duration: 450 },
      });
    });
    return () => {
      cancelAnimationFrame(frame);
      chart?.destroy();
    };
  }, [dataKey, theme]);

  return (
    <div className="Line_Chart">
      <div className="Line_Chart_Header">
        <span className="Line_Chart_Title">{title}</span>
        {subtitle && <span className="Line_Chart_Subtitle">{subtitle}</span>}
      </div>
      <div className="Line_Chart_Body">
        <div className="Line_Chart_Canvas" ref={chartRef} />
      </div>
    </div>
  );
};

export default Line_Chart;

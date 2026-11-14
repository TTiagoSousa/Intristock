import { useEffect, useRef } from 'react';
import { createBarChart } from 'openchartscandle/bar';
import type { BarItem, BarTheme } from 'openchartscandle/bar';
import { createLineChart } from 'openchartscandle/line';
import type { LineTheme } from 'openchartscandle/line';
import 'openchartscandle/style.css';
import { useTheme } from '../../../Contexts/ThemeContext';
import { resolveColor } from '../resolveColor';
import './Month_Chart.scss';

// Uma série: um valor por mês (nulo = sem barra / a linha não passa)
export interface Month_Chart_Series {
  id: string;
  name: string;
  values: (number | null)[];
  // A cor, um token CSS (`--gain`)
  colorToken: string;
  // Mais clara nas barras e a tracejado nas linhas: o que ainda não aconteceu
  faded?: boolean;
}

interface Month_Chart_Props {
  kind: 'bars' | 'lines';
  // Os nomes curtos no eixo e os compridos no tooltip, um por mês
  categories: string[];
  labels: string[];
  series: Month_Chart_Series[];
  // As barras empilham (o recebido e o por receber do mesmo mês)
  stacked?: boolean;
  // O mês atual, marcado com a linha do «Hoje»
  todayIndex?: number;
  todayLabel?: string;
  format: (value: number) => string;
  compact: (value: number) => string;
}

const escape = (text: string) =>
  text.replace(/[&<>"]/g, (char) => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;' })[char] ?? char);

/**
 * Um gráfico por mês da `trading-chart`, em barras ou em linhas: o das finanças
 * pessoais (ganhos, despesas, dívidas). Os dados vêm já contados; o gráfico
 * refaz-se quando mudam, com o tema ou ao trocar barras/linhas.
 */
const Month_Chart = ({ kind, categories, labels, series, stacked, todayIndex, todayLabel, format, compact }: Month_Chart_Props) => {
  const { theme } = useTheme();
  const chartRef = useRef<HTMLDivElement>(null);
  // O mais recente para o gráfico criado na frame seguinte, sem o refazer a cada render
  const latest = useRef({ labels, series, format, compact, todayIndex, todayLabel });
  useEffect(() => {
    latest.current = { labels, series, format, compact, todayIndex, todayLabel };
  });
  const dataKey = JSON.stringify({ categories, labels, series, stacked, todayIndex, todayLabel });

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
        text: token('month-chart-text'),
        muted: token('month-chart-muted'),
        grid: token('month-chart-grid'),
        axis: token('month-chart-axis'),
        tooltipBg: token('month-chart-tooltip-background'),
        tooltipText: token('month-chart-tooltip-text'),
        tooltipBorder: token('month-chart-tooltip-border'),
        font: getComputedStyle(document.body).fontFamily,
      };
      const todayColor = token('month-chart-today');
      const colors = current.series.map((part) => token(part.colorToken.replace(/^--/, '')));

      // O tooltip: o mês e cada série com valor nesse mês
      const tooltip = (index: number) => {
        const rows = current.series
          .map((part, position) => ({ part, value: part.values[index], color: colors[position] }))
          .filter((row) => (row.value ?? 0) > 0)
          .map(
            (row) =>
              `<div class="Month_Chart_Tip_Row"><span class="Month_Chart_Tip_Dot" style="background:${row.color}"></span>` +
              `<span class="Month_Chart_Tip_Name">${escape(row.part.name)}</span>` +
              `<span class="Month_Chart_Tip_Value">${escape(current.format(row.value ?? 0))}</span></div>`,
          )
          .join('');
        return `<div class="Month_Chart_Tip"><span class="Month_Chart_Tip_Label">${escape(current.labels[index] ?? '')}</span>${rows}</div>`;
      };

      if (kind === 'bars') {
        chart = createBarChart(element, {
          categories,
          series: current.series.map((part, position) => {
            const data: BarItem[] = part.values.map((value) => ({ value, opacity: part.faded ? 0.35 : 1 }));
            return { id: part.id, name: part.name, data, color: colors[position], stack: stacked ? 'months' : undefined };
          }),
          stacked: !!stacked,
          theme: { ...look, hover: token('month-chart-hover') } as Partial<BarTheme>,
          padding: 4,
          categoryGap: 0.3,
          maxBarWidth: 36,
          radius: 4,
          legend: { show: true, position: 'bottom', align: 'center', marker: 'circle', fontSize: 11 },
          categoryAxis: { show: true, grid: false, ticks: false },
          valueAxis: { show: true, grid: true, format: (value) => current.compact(value) },
          tooltip: { mode: 'shared', total: false, formatter: (ctx) => tooltip(ctx.categoryIndex) },
          // A linha do «Hoje» por cima das barras
          graphic: (ctx, api) => {
            if (current.todayIndex == null) return;
            const x = api.category(current.todayIndex);
            ctx.save();
            ctx.strokeStyle = todayColor;
            ctx.setLineDash([4, 4]);
            ctx.beginPath();
            ctx.moveTo(x, api.plot.y);
            ctx.lineTo(x, api.plot.y + api.plot.h);
            ctx.stroke();
            if (current.todayLabel) {
              ctx.fillStyle = look.muted;
              ctx.font = `10px ${look.font}`;
              ctx.fillText(current.todayLabel, x + 4, api.plot.y + 10);
            }
            ctx.restore();
          },
          animation: { duration: 450 },
        });
      } else {
        chart = createLineChart(element, {
          categories,
          xType: 'category',
          series: current.series.map((part, position) => ({
            id: part.id,
            name: part.name,
            data: part.values,
            color: colors[position],
            dash: part.faded ? [5, 4] : undefined,
            points: { size: 3 },
          })),
          curve: 'smooth',
          theme: { ...look, crosshair: look.muted } as Partial<LineTheme>,
          padding: 4,
          legend: { show: true, position: 'bottom', align: 'center', marker: 'line', fontSize: 11 },
          yAxis: { grid: true, beginAtZero: true, format: (value) => current.compact(value) },
          xAxis: { grid: false },
          tooltip: { mode: 'shared', formatter: (ctx) => tooltip(ctx.x) },
          annotations:
            current.todayIndex != null
              ? { x: [{ value: categories[current.todayIndex], label: current.todayLabel, color: todayColor, dash: [4, 4] }] }
              : undefined,
          animation: { duration: 450 },
        });
      }
    });
    return () => {
      cancelAnimationFrame(frame);
      chart?.destroy();
    };
    // O gráfico refaz-se com os dados, o tipo e o tema
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [dataKey, kind, theme]);

  return <div className="Month_Chart" ref={chartRef} />;
};

export default Month_Chart;

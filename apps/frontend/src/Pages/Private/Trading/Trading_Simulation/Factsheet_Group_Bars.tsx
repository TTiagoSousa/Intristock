import { useEffect, useRef } from 'react';
import { useTranslation } from 'react-i18next';
import { createBarChart } from 'openchartscandle/bar';
import type { BarItem, BarTheme } from 'openchartscandle/bar';
import 'openchartscandle/style.css';
import { useTheme } from '../../../../Contexts/ThemeContext';
import Factsheet_Panel from './Factsheet_Panel';
import { resolveToken } from './factsheetFormat';

// Uma série das barras lado a lado: um valor e um rótulo por coluna
export interface Group_Bars_Series {
  id: string;
  name: string;
  // Nulo = sem barra
  values: (number | null)[];
  labels: string[];
  // O token da cor (`--factsheet-<token>`); com `negativeToken`, a das barras abaixo de 0
  colorToken: string;
  negativeToken?: string;
}

interface Factsheet_Group_Bars_Props {
  title: string;
  // A explicação do \"?\" (trading.fsExplain_<explain>_*)
  explain?: string;
  note: string;
  categories: string[];
  series: Group_Bars_Series[];
  // O tooltip de cada coluna (HTML)
  tooltip: (index: number) => string;
  // As séries escondidas, partilhadas por vários gráficos: a legenda de cada um avisa com `onToggle`
  hidden?: Set<string>;
  onToggle?: (id: string, hidden: boolean) => void;
  // Barras só para cima (contagens); sem isto, o P&L desce abaixo de 0
  positive?: boolean;
}

/**
 * 5.3 — Barras lado a lado por categoria (os dias da semana): os stops pela
 * entrada e pela saída, ou os stops, ganhos e P&L de cada entrada. O número vai
 * por cima de cada barra e a legenda por cima (liga e desliga cada série); tudo
 * vem calculado pelo simulador.
 */
const Factsheet_Group_Bars = ({
  title,
  note,
  explain,
  categories,
  series,
  tooltip,
  hidden,
  onToggle,
  positive,
}: Factsheet_Group_Bars_Props) => {
  const { theme } = useTheme();
  const { i18n } = useTranslation();
  const rootRef = useRef<HTMLDivElement>(null);
  const chartRef = useRef<HTMLDivElement>(null);
  const instanceRef = useRef<ReturnType<typeof createBarChart> | null>(null);
  // As séries escondidas e o tooltip mais recentes, para o gráfico que se cria na frame seguinte
  const hiddenRef = useRef(hidden);
  const tooltipRef = useRef(tooltip);
  const toggleRef = useRef(onToggle);
  useEffect(() => {
    hiddenRef.current = hidden;
    tooltipRef.current = tooltip;
    toggleRef.current = onToggle;
  });

  useEffect(() => {
    const element = chartRef.current;
    const root = rootRef.current;
    if (!element || !root) return;
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
      instanceRef.current = createBarChart(element, {
        categories,
        series: series.map((part) => {
          const color = token(part.colorToken);
          const negative = part.negativeToken ? token(part.negativeToken) : color;
          const data: BarItem[] = part.values.map((value, index) => ({
            value,
            color: value != null && value < 0 ? negative : color,
            label: part.labels[index],
          }));
          return { id: part.id, name: part.name, data, color, hidden: hiddenRef.current?.has(part.id) };
        }),
        theme: barTheme,
        padding: 4,
        categoryGap: 0.22,
        barGap: 0.08,
        radius: 2,
        legend: { show: true, position: 'top', align: 'start', marker: 'square', fontSize: 11.5 },
        categoryAxis: { show: true, grid: false, ticks: false },
        valueAxis: { show: false, grid: false, ...(positive ? { min: 0 } : {}) },
        labels: { show: true, position: 'outside', fontSize: 10, format: (_, datum) => datum.item?.label ?? '' },
        tooltip: { mode: 'shared', formatter: (ctx) => tooltipRef.current(ctx.categoryIndex) },
        animation: { duration: 500 },
      });
      instanceRef.current.on('toggle', ({ id, hidden: isHidden }) => toggleRef.current?.(id, isHidden));
    });
    return () => {
      cancelAnimationFrame(frame);
      instanceRef.current?.destroy();
      instanceRef.current = null;
    };
    // O gráfico refaz-se com os dados, a língua e o tema
  }, [categories, series, positive, i18n.language, theme]);

  // Esconder e mostrar séries sem refazer o gráfico
  useEffect(() => {
    const chart = instanceRef.current;
    if (!chart) return;
    for (const part of series) chart.toggle(part.id, hidden?.has(part.id) ?? false);
  }, [hidden, series]);

  return (
    <Factsheet_Panel title={title} note={note} explain={explain} panelRef={rootRef}>
      <div className="Factsheet_Chart Weekday" ref={chartRef} />
    </Factsheet_Panel>
  );
};

export default Factsheet_Group_Bars;

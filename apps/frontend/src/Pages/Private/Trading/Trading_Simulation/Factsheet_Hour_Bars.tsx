import { useEffect, useRef } from 'react';
import type { ReactNode } from 'react';
import { useTranslation } from 'react-i18next';
import { createBarChart } from 'openchartscandle/bar';
import type { BarItem, BarTheme } from 'openchartscandle/bar';
import 'openchartscandle/style.css';
import { useTheme } from '../../../../Contexts/ThemeContext';
import Factsheet_Panel from './Factsheet_Panel';
import { hourLabel, resolveToken } from './factsheetFormat';

// Uma cor das barras, com o nome que aparece na legenda (ex.: lucro e perda)
export interface Hour_Bars_Part {
  id: string;
  name: string;
  // O token da cor (`--factsheet-<token>`)
  colorToken: string;
}

// A opacidade das barras de amostra pequena
const FADED_OPACITY = 0.35;

interface Factsheet_Hour_Bars_Props {
  title: string;
  // A explicação do \"?\" (trading.fsExplain_<explain>_*)
  explain?: string;
  note: string;
  // As cores da legenda; cada barra é de uma delas
  parts: Hour_Bars_Part[];
  // Um valor por hora (0 a 23); nulo = sem barra
  values: (number | null)[];
  // O número por cima de cada barra
  labels: string[];
  // A parte (id) de cada barra; sem isto, a primeira
  partOf?: (hour: number, value: number) => string;
  // O tooltip de cada hora (HTML)
  tooltip: (hour: number) => string;
  // Barras só para cima (contagens); sem isto, o P&L desce abaixo de 0
  positive?: boolean;
  // As colunas (por omissão as horas) e a classe da altura
  categories?: string[];
  size?: string;
  // Os nomes das colunas por baixo (por omissão à vista) e uma linha por baixo do gráfico
  axis?: boolean;
  footer?: ReactNode;
  // As barras com poucos trades (amostra pequena): ficam esbatidas
  faded?: boolean[];
}

/**
 * 5.1, 5.2 e 5.3 — Uma coluna por hora do dia (ou por dia da semana), com o
 * número por cima de cada uma e a legenda das cores (liga e desliga cada uma).
 * Cada cor é uma série empilhada só com as barras dela, por isso cada coluna
 * tem uma barra. Os valores, os rótulos e as cores vêm de quem o usa; tudo já
 * calculado pelo simulador.
 */
const Factsheet_Hour_Bars = ({
  title,
  note,
  explain,
  parts,
  values,
  labels,
  partOf,
  tooltip,
  positive,
  categories,
  size = 'Hour_Bars',
  axis = true,
  footer,
  faded,
}: Factsheet_Hour_Bars_Props) => {
  const { theme } = useTheme();
  const { i18n } = useTranslation();
  const rootRef = useRef<HTMLDivElement>(null);
  const chartRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    const element = chartRef.current;
    const root = rootRef.current;
    if (!element || !root) return;
    let chart: ReturnType<typeof createBarChart> | null = null;
    // Na frame seguinte: o data-theme do <html> muda depois deste efeito
    const frame = requestAnimationFrame(() => {
      const token = (tokenName: string) => resolveToken(root, tokenName);
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
      const owner = values.map((value, hour) => (value == null ? null : (partOf?.(hour, value) ?? parts[0]?.id)));

      chart = createBarChart(element, {
        categories: categories ?? values.map((_, hour) => hourLabel(hour)),
        series: parts.map((part) => ({
          id: part.id,
          name: part.name,
          color: token(part.colorToken),
          stack: 'bars',
          data: values.map<BarItem>((value, hour) => ({
            value: owner[hour] === part.id ? value : null,
            label: labels[hour],
            opacity: faded?.[hour] ? FADED_OPACITY : undefined,
          })),
        })),
        stacked: true,
        theme: barTheme,
        padding: 4,
        categoryGap: 0.18,
        radius: 2,
        legend: { show: true, position: 'top', align: 'start', marker: 'square', fontSize: 11.5 },
        categoryAxis: { show: axis, grid: false, ticks: false },
        valueAxis: { show: false, grid: false, ...(positive ? { min: 0 } : {}) },
        labels: { show: true, position: 'outside', fontSize: 10, format: (_, datum) => datum.item?.label ?? '' },
        tooltip: { mode: 'shared', total: false, formatter: (ctx) => tooltip(ctx.categoryIndex) },
        animation: { duration: 500 },
      });
    });
    return () => {
      cancelAnimationFrame(frame);
      chart?.destroy();
    };
    // As funções mudam a cada render; o gráfico refaz-se com os dados, a língua e o tema
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [values, labels, parts, positive, categories, axis, faded, i18n.language, theme]);

  return (
    <Factsheet_Panel title={title} note={note} explain={explain} panelRef={rootRef}>
      <div className={`Factsheet_Chart ${size}`} ref={chartRef} />
      {footer && <div className="Factsheet_Chart_Footer">{footer}</div>}
    </Factsheet_Panel>
  );
};

export default Factsheet_Hour_Bars;

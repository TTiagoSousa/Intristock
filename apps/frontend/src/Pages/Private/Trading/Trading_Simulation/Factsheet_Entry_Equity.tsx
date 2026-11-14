import { useEffect, useMemo, useRef } from 'react';
import { useTranslation } from 'react-i18next';
import { createLineChart } from 'openchartscandle/line';
import type { LineTheme } from 'openchartscandle/line';
import 'openchartscandle/style.css';
import { useTheme } from '../../../../Contexts/ThemeContext';
import type { Entry_Equity, Entry_Payload } from '../../../../Hooks/Trading/useSimulation';
import { formatNumber } from '../Trading_Simulator/format';
import { entryLabel } from '../Trading_Simulator/labels';
import { entryColor } from './factsheetFormat';
import Factsheet_Panel from './Factsheet_Panel';

interface Factsheet_Entry_Equity_Props {
  curve: Entry_Equity;
  entries: Entry_Payload[];
  unit: string;
  quote: string;
}

// O canvas não lê variáveis CSS: as cores saem dos tokens já resolvidos
const tokenReader = (element: HTMLElement) => {
  const style = getComputedStyle(element);
  return (name: string) => style.getPropertyValue(`--factsheet-${name}`).trim();
};

// O eixo do tempo pode dar segundos ou milissegundos
const toMs = (x: number) => (x < 1e11 ? x * 1000 : x);

/**
 * 4.1 — Equity por entrada: o P&L acumulado de cada entrada, em degraus (muda em
 * cada saída), com a linha do 0. A legenda (da biblioteca) leva o nome e o total
 * de cada uma e um clique liga e desliga a linha.
 */
const Factsheet_Entry_Equity = ({ curve, entries, unit, quote }: Factsheet_Entry_Equity_Props) => {
  const { t, i18n } = useTranslation();
  const language = i18n.language;
  const { theme } = useTheme();
  const rootRef = useRef<HTMLDivElement>(null);
  const chartRef = useRef<HTMLDivElement>(null);

  const money = (value: number) => `${value > 0 ? '+' : value < 0 ? '−' : ''}${formatNumber(Math.abs(value), language, 0)} ${unit}`;
  const series = useMemo(
    () =>
      curve.series.map((line) => ({
        rule: line.rule,
        total: line.total,
        name: entryLabel(entries, line.rule, t),
        // Em degraus: em cada saída, o valor anterior e o novo no mesmo instante
        data: line.points.flatMap(([x, y], i) =>
          i === 0 ? [{ x, y }] : [{ x, y: line.points[i - 1][1] }, { x, y }],
        ),
      })),
    [curve, entries, t],
  );

  useEffect(() => {
    const element = chartRef.current;
    const root = rootRef.current;
    if (!element || !root) return;
    let chart: ReturnType<typeof createLineChart> | null = null;
    // Na frame seguinte: o data-theme do <html> muda depois deste efeito
    const frame = requestAnimationFrame(() => {
      const token = tokenReader(root);
      const lineTheme: Partial<LineTheme> = {
        background: 'transparent',
        text: token('chart-text'),
        muted: token('chart-muted'),
        grid: token('chart-grid'),
        axis: token('chart-axis'),
        crosshair: token('chart-muted'),
        tooltipBg: token('chart-tooltip-background'),
        tooltipText: token('chart-tooltip-text'),
        tooltipBorder: token('chart-tooltip-border'),
        font: getComputedStyle(document.body).fontFamily,
      };
      const day = new Intl.DateTimeFormat(language, { day: '2-digit', month: '2-digit', year: 'numeric', timeZone: 'UTC' });

      chart = createLineChart(element, {
        xType: 'time',
        series: series.map((line) => ({
          id: String(line.rule),
          name: `${line.name} ${money(line.total)}`,
          data: line.data,
          color: token(`entry-${entryColor(line.rule)}`),
          width: 1.6,
        })),
        theme: lineTheme,
        padding: 4,
        // A legenda da biblioteca: um clique liga e desliga cada entrada
        legend: { show: true, position: 'top', align: 'start', marker: 'line', fontSize: 11.5 },
        xAxis: { show: false, grid: false },
        yAxis: { show: false, grid: false },
        annotations: { y: [{ value: 0, color: token('chart-axis') }] },
        crosshair: { show: true },
        tooltip: {
          mode: 'shared',
          formatter: (ctx) => {
            const rows = ctx.points
              .map((point) => `<span style="color:${point.color}">●</span> ${point.series.name}: <strong>${money(point.y)}</strong>`)
              .join('<br>');
            return `<strong>${day.format(new Date(toMs(ctx.x)))}</strong><br>${rows}`;
          },
        },
        animation: { duration: 500 },
      });
    });
    return () => {
      cancelAnimationFrame(frame);
      chart?.destroy();
    };
    // money depende só da língua e da moeda
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [series, language, unit, theme]);

  return (
    <Factsheet_Panel title={t('trading.fsEntEquityTitle')} explain="entryEquity" note={t('trading.fsEntEquityNote', { quote })} panelRef={rootRef}>
      <div className="Factsheet_Chart Entry_Equity" ref={chartRef} />
    </Factsheet_Panel>
  );
};

export default Factsheet_Entry_Equity;

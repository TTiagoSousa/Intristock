import { useEffect, useMemo, useRef } from 'react';
import { useTranslation } from 'react-i18next';
import { createLineChart } from 'openchartscandle/line';
import type { LineTheme } from 'openchartscandle/line';
import 'openchartscandle/style.css';
import { useTheme } from '../../../../Contexts/ThemeContext';
import type { Sample_Equity } from '../../../../Hooks/Trading/useSimulation';
import { formatNumber } from '../Trading_Simulator/format';
import Factsheet_Panel from './Factsheet_Panel';

interface Factsheet_Sample_Equity_Props {
  curve: Sample_Equity;
  // A moeda do capital ("$" ou a cotada)
  unit: string;
}

// O canvas não lê variáveis CSS: as cores saem dos tokens já resolvidos
const tokenReader = (element: HTMLElement) => {
  const style = getComputedStyle(element);
  return (name: string) => style.getPropertyValue(`--factsheet-${name}`).trim();
};

// O eixo do tempo pode dar segundos ou milissegundos
const toMs = (x: number) => (x < 1e11 ? x * 1000 : x);

/**
 * 3.1 — Equity com a divisão: o capital de cada dia, com a linha tracejada no dia
 * em que o período se divide e a parte de fora da amostra sombreada. Os pontos e
 * o dia vêm já calculados (bloco `sampleEquity`).
 */
const Factsheet_Sample_Equity = ({ curve, unit }: Factsheet_Sample_Equity_Props) => {
  const { t, i18n } = useTranslation();
  const language = i18n.language;
  const { theme } = useTheme();
  const rootRef = useRef<HTMLDivElement>(null);
  const chartRef = useRef<HTMLDivElement>(null);

  const data = useMemo(() => curve.points.map(([x, y]) => ({ x, y })), [curve]);
  const day = useMemo(
    () => new Intl.DateTimeFormat(language, { day: '2-digit', month: '2-digit', year: 'numeric', timeZone: 'UTC' }),
    [language],
  );
  const first = curve.points[0][0];
  const last = curve.points[curve.points.length - 1][0];

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

      chart = createLineChart(element, {
        xType: 'time',
        series: [{ id: 'equity', name: t('trading.fsSampleEquityTitle'), data, color: token('chart-strategy'), width: 1.6 }],
        theme: lineTheme,
        padding: 4,
        legend: { show: false },
        // Sem eixos à vista: o início, a divisão e o fim leem-se por baixo
        xAxis: { show: false, grid: false },
        yAxis: { show: false, grid: false },
        annotations: {
          xBands: [{ from: curve.splitTime, to: last, color: token('chart-out-sample') }],
          x: [{ value: curve.splitTime, color: token('chart-split'), dash: [4, 4] }],
        },
        crosshair: { show: true },
        tooltip: {
          mode: 'shared',
          formatter: (ctx) => {
            const point = ctx.points[0];
            if (!point) return '';
            return `<strong>${day.format(new Date(toMs(ctx.x)))}</strong><br><span style="color:${point.color}">●</span> <strong>${formatNumber(point.y, language, 2)} ${unit}</strong>`;
          },
        },
        animation: { duration: 500 },
      });
    });
    return () => {
      cancelAnimationFrame(frame);
      chart?.destroy();
    };
    // t muda com a língua, que já está nas dependências
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [data, curve, last, day, unit, language, theme]);

  return (
    <Factsheet_Panel title={t('trading.fsSampleEquityTitle')} explain="proofSampleEquity" note={t('trading.fsSampleEquityNote')} panelRef={rootRef}>
      <div className="Factsheet_Chart Sample_Equity" ref={chartRef} />
      <div className="Factsheet_Chart_Footer">
        <span>{day.format(new Date(toMs(first)))}</span>
        <span>{t('trading.fsSampleEquitySplit', { date: day.format(new Date(toMs(curve.splitTime))) })}</span>
        <span>{day.format(new Date(toMs(last)))}</span>
      </div>
    </Factsheet_Panel>
  );
};

export default Factsheet_Sample_Equity;

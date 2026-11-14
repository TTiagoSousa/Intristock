import { useEffect, useMemo, useRef } from 'react';
import { useTranslation } from 'react-i18next';
import { createLineChart } from 'openchartscandle/line';
import type { LineTheme } from 'openchartscandle/line';
import 'openchartscandle/style.css';
import { useTheme } from '../../../../Contexts/ThemeContext';
import type { Chart_Underwater } from '../../../../Hooks/Trading/useSimulation';
import { formatNumber } from '../Trading_Simulator/format';
import Factsheet_Panel from './Factsheet_Panel';

interface Factsheet_Underwater_Props {
  curve: Chart_Underwater;
}

// O canvas não lê variáveis CSS: as cores saem dos tokens já resolvidos
const tokenReader = (element: HTMLElement) => {
  const style = getComputedStyle(element);
  return (name: string) => style.getPropertyValue(`--factsheet-${name}`).trim();
};

// O eixo do tempo pode dar segundos ou milissegundos
const toMs = (x: number) => (x < 1e11 ? x * 1000 : x);

/**
 * 1.2 — Underwater: a distância de cada dia ao máximo anterior do índice de
 * performance (sem depósitos). O 0 fica em cima e a área desce até à queda; o
 * fundo é a maior queda. Os pontos vêm já calculados.
 */
const Factsheet_Underwater = ({ curve }: Factsheet_Underwater_Props) => {
  const { t, i18n } = useTranslation();
  const language = i18n.language;
  const { theme } = useTheme();
  const rootRef = useRef<HTMLDivElement>(null);
  const chartRef = useRef<HTMLDivElement>(null);

  const percent = (value: number) => `${value < 0 ? '−' : ''}${formatNumber(Math.abs(value), language, 1)}%`;
  const deepest = percent(-curve.maxDrawdownPct);

  const data = useMemo(() => curve.points.map(([x, y]) => ({ x, y })), [curve]);

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
        // A área vai da linha até ao 0, que fica em cima
        series: [{ id: 'underwater', name: t('trading.fsUnderwaterTitle'), data, color: token('chart-drawdown'), width: 1.2, area: { opacity: 0.4 } }],
        theme: lineTheme,
        padding: 4,
        legend: { show: false },
        // Sem eixos à vista: o 0 e a maior queda leem-se por baixo
        xAxis: { show: false, grid: false },
        yAxis: { show: false, grid: false, min: -Math.max(curve.maxDrawdownPct, 0.1), max: 0 },
        crosshair: { show: true },
        tooltip: {
          mode: 'shared',
          formatter: (ctx) => {
            const point = ctx.points[0];
            if (!point) return '';
            return `<strong>${day.format(new Date(toMs(ctx.x)))}</strong><br><span style="color:${point.color}">●</span> <strong>${percent(point.y)}</strong>`;
          },
        },
        animation: { duration: 500 },
      });
    });
    return () => {
      cancelAnimationFrame(frame);
      chart?.destroy();
    };
    // percent depende só da língua
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [data, curve, language, t, theme]);

  return (
    <Factsheet_Panel explain="sumUnderwater" title={t('trading.fsUnderwaterTitle')} note={t('trading.fsUnderwaterNote')} panelRef={rootRef}>
      <div className="Factsheet_Chart Underwater" ref={chartRef} />
      <div className="Factsheet_Chart_Footer">
        <span>0%</span>
        <span>{t('trading.fsUnderwaterSummary', { max: deepest, days: formatNumber(curve.longestDays, language, 0) })}</span>
        <span>{deepest}</span>
      </div>
    </Factsheet_Panel>
  );
};

export default Factsheet_Underwater;

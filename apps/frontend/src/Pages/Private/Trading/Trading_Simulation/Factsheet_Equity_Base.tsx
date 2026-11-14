import { useEffect, useMemo, useRef } from 'react';
import { useTranslation } from 'react-i18next';
import { createLineChart } from 'openchartscandle/line';
import type { LineTheme } from 'openchartscandle/line';
import 'openchartscandle/style.css';
import { useTheme } from '../../../../Contexts/ThemeContext';
import type { Chart_Equity_In_Base } from '../../../../Hooks/Trading/useSimulation';
import { formatNumber } from '../Trading_Simulator/format';
import Factsheet_Panel from './Factsheet_Panel';

interface Factsheet_Equity_Base_Props {
  curve: Chart_Equity_In_Base;
  // O ativo em que se mede o capital ("BTC") e a moeda cotada ("USDT")
  asset: string;
  quoteCode: string;
}

// As quantidades do ativo leem-se com 4 casas
const DIGITS = 4;

// O canvas não lê variáveis CSS: as cores saem dos tokens já resolvidos
const tokenReader = (element: HTMLElement) => {
  const style = getComputedStyle(element);
  return (name: string) => style.getPropertyValue(`--factsheet-${name}`).trim();
};

// O eixo do tempo pode dar segundos ou milissegundos
const toMs = (x: number) => (x < 1e11 ? x * 1000 : x);

/**
 * 1.2 — Equity no ativo: o capital de cada dia dividido pelo preço do ativo, com a
 * quantidade inicial a tracejado. Os pontos vêm já calculados.
 */
const Factsheet_Equity_Base = ({ curve, asset, quoteCode }: Factsheet_Equity_Base_Props) => {
  const { t, i18n } = useTranslation();
  const language = i18n.language;
  const { theme } = useTheme();
  const rootRef = useRef<HTMLDivElement>(null);
  const chartRef = useRef<HTMLDivElement>(null);

  const quantity = (value: number) => `${formatNumber(value, language, DIGITS)} ${asset}`;

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
      const color = token('chart-base');

      chart = createLineChart(element, {
        xType: 'time',
        series: [{ id: 'base', name: asset, data, color, width: 1.6 }],
        theme: lineTheme,
        padding: 4,
        legend: { show: false },
        // Sem eixos à vista: o início e o fim leem-se por baixo
        xAxis: { show: false, grid: false },
        yAxis: { show: false, grid: true, ticks: 4 },
        annotations: {
          y: [{ value: curve.initialQuantity, color: token('chart-muted'), dash: [3, 4] }],
        },
        crosshair: { show: true },
        tooltip: {
          mode: 'shared',
          formatter: (ctx) => {
            const point = ctx.points[0];
            if (!point) return '';
            return `<strong>${day.format(new Date(toMs(ctx.x)))}</strong><br><span style="color:${point.color}">●</span> <strong>${quantity(point.y)}</strong>`;
          },
        },
        animation: { duration: 500 },
      });
    });
    return () => {
      cancelAnimationFrame(frame);
      chart?.destroy();
    };
    // quantity depende só da língua e do ativo
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [data, curve, asset, language, theme]);

  return (
    <Factsheet_Panel explain="sumEquityBase" title={t('trading.fsEquityBaseTitle', { asset })} note={t('trading.fsEquityBaseNote', { quote: quoteCode })} panelRef={rootRef}>
      <div className="Factsheet_Chart Equity_Base" ref={chartRef} />
      <div className="Factsheet_Chart_Footer">
        <span>{t('trading.fsEquityBaseStart', { value: quantity(curve.initialQuantity) })}</span>
        <span>{t('trading.fsEquityBaseDashed')}</span>
        <span>{t('trading.fsEquityBaseEnd', { value: quantity(curve.finalQuantity) })}</span>
      </div>
    </Factsheet_Panel>
  );
};

export default Factsheet_Equity_Base;

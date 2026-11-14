import { useEffect, useMemo, useRef } from 'react';
import { useTranslation } from 'react-i18next';
import { createBarChart } from 'openchartscandle/bar';
import type { BarItem, BarTheme } from 'openchartscandle/bar';
import 'openchartscandle/style.css';
import { useTheme } from '../../../../Contexts/ThemeContext';
import { DAILY_DISTRIBUTION } from '../../../../Hooks/Trading/useSimulation';
import type { Chart_Daily_Distribution } from '../../../../Hooks/Trading/useSimulation';
import { formatNumber } from '../Trading_Simulator/format';
import Factsheet_Panel from './Factsheet_Panel';

interface Factsheet_Distribution_Props {
  distribution: Chart_Daily_Distribution;
}

// O eixo vai até esta folga acima da maior barra que não seja a do 0 (ou da normal): os
// dias sem mexer (fora do mercado) fazem uma barra enorme que esconderia as caudas
const AXIS_HEADROOM = 1.35;

// O canvas não lê variáveis CSS: as cores saem dos tokens já resolvidos
const tokenReader = (element: HTMLElement) => {
  const style = getComputedStyle(element);
  return (name: string) => style.getPropertyValue(`--factsheet-${name}`).trim();
};

/**
 * 1.3 — Distribuição dos retornos diários: as barras são os dias reais em cada
 * intervalo de retorno e a linha é a normal com a mesma média e desvio. Uma barra
 * cortada pelo eixo leva o número de dias por cima. Tudo vem calculado.
 */
const Factsheet_Distribution = ({ distribution }: Factsheet_Distribution_Props) => {
  const { t, i18n } = useTranslation();
  const language = i18n.language;
  const { theme } = useTheme();
  const rootRef = useRef<HTMLDivElement>(null);
  const chartRef = useRef<HTMLDivElement>(null);

  const percent = (value: number, digits = 1) =>
    `${value > 0 ? '+' : value < 0 ? '−' : ''}${formatNumber(Math.abs(value), language, digits)}%`;
  const span = `${formatNumber(distribution.rangePct, language, 1)}%`;

  const shape = useMemo(() => {
    const bins = distribution.bins;
    const days = bins.map((bin) => bin[DAILY_DISTRIBUTION.days]);
    const normal = bins.map((bin) => bin[DAILY_DISTRIBUTION.normalDays]);
    const tallest = Math.max(...days);
    const rest = days.filter((value) => value !== tallest);
    const top = Math.max(Math.max(...rest, 0), ...normal, 1) * AXIS_HEADROOM;
    return { bins, days, normal, max: tallest > top ? top : undefined };
  }, [distribution]);

  useEffect(() => {
    const element = chartRef.current;
    const root = rootRef.current;
    if (!element || !root) return;
    let chart: ReturnType<typeof createBarChart> | null = null;
    // Na frame seguinte: o data-theme do <html> muda depois deste efeito
    const frame = requestAnimationFrame(() => {
      const token = tokenReader(root);
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
      const up = token('chart-strategy');
      const down = token('chart-drawdown');
      const max = shape.max;
      const label = (from: number, to: number) => t('trading.fsDistributionRange', { from: percent(from, 2), to: percent(to, 2) });

      chart = createBarChart(element, {
        categories: shape.bins.map((bin) => label(bin[DAILY_DISTRIBUTION.fromPct], bin[DAILY_DISTRIBUTION.toPct])),
        series: [
          {
            id: 'days',
            name: t('trading.fsDistributionDays'),
            // Laranja abaixo de 0, azul acima; a barra cortada pelo eixo leva o número
            data: shape.bins.map((bin, i): BarItem => {
              const middle = (bin[DAILY_DISTRIBUTION.fromPct] + bin[DAILY_DISTRIBUTION.toPct]) / 2;
              const value = shape.days[i];
              return {
                value: max !== undefined ? Math.min(value, max) : value,
                color: middle < 0 ? down : up,
                label: max !== undefined && value > max ? formatNumber(value, language, 0) : '',
              };
            }),
          },
        ],
        overlays: [
          {
            type: 'line',
            id: 'normal',
            name: t('trading.fsDistributionNormal'),
            data: shape.normal,
            color: token('chart-normal'),
            width: 1.6,
            smooth: true,
            axis: 'left',
          },
        ],
        theme: barTheme,
        padding: 4,
        categoryGap: 0.12,
        radius: 2,
        legend: { show: false },
        categoryAxis: { show: false, grid: false },
        valueAxis: { show: false, grid: true, min: 0, max },
        labels: { show: true, position: 'inside', fontSize: 10.5, color: token('chart-tooltip-text') },
        tooltip: {
          mode: 'shared',
          formatter: (ctx) => {
            const i = ctx.categoryIndex;
            const normal = formatNumber(shape.normal[i], language, 1);
            return `<strong>${ctx.category}</strong><br>${t('trading.fsDistributionDays')}: <strong>${formatNumber(shape.days[i], language, 0)}</strong><br>${t('trading.fsDistributionNormal')}: <strong>${normal}</strong>`;
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
  }, [shape, language, t, theme]);

  return (
    <Factsheet_Panel explain="sumDistribution" title={t('trading.fsDistributionTitle')} note={t('trading.fsDistributionNote')} panelRef={rootRef}>
      <div className="Factsheet_Chart Distribution" ref={chartRef} />
      <div className="Factsheet_Chart_Footer">
        <span>−{span}</span>
        <span>0%</span>
        <span>{span}</span>
      </div>
    </Factsheet_Panel>
  );
};

export default Factsheet_Distribution;

import { useEffect, useMemo, useRef } from 'react';
import { useTranslation } from 'react-i18next';
import { createLineChart } from 'openchartscandle/line';
import type { LineTheme } from 'openchartscandle/line';
import 'openchartscandle/style.css';
import { useTheme } from '../../../../Contexts/ThemeContext';
import { EQUITY_CURVE } from '../../../../Hooks/Trading/useSimulation';
import type { Chart_Equity_Curve } from '../../../../Hooks/Trading/useSimulation';
import { formatNumber } from '../Trading_Simulator/format';
import Factsheet_Panel from './Factsheet_Panel';

interface Factsheet_Equity_Props {
  curve: Chart_Equity_Curve;
  // Como se escreve a moeda cotada ("$") e o código dela ("USDT")
  quoteLabel: string;
  quoteCode: string;
}

// O drawdown fica no fundo: a escala dele vai até 3× a maior queda (um terço da altura)
const DRAWDOWN_SHARE = 3;

// O canvas não lê variáveis CSS: as cores saem dos tokens já resolvidos
const tokenReader = (element: HTMLElement) => {
  const style = getComputedStyle(element);
  return (name: string) => style.getPropertyValue(`--factsheet-${name}`).trim();
};

// O eixo do tempo pode dar segundos ou milissegundos
const toMs = (x: number) => (x < 1e11 ? x * 1000 : x);

/**
 * 1.2 — Equity e drawdown: o capital da estratégia contra comprar e manter, em
 * escala logarítmica, e o drawdown da estratégia em área no fundo, com escala
 * própria (eixo da direita, escondido). Os pontos vêm já calculados.
 */
const Factsheet_Equity = ({ curve, quoteLabel, quoteCode }: Factsheet_Equity_Props) => {
  const { t, i18n } = useTranslation();
  const language = i18n.language;
  const { theme } = useTheme();
  const rootRef = useRef<HTMLDivElement>(null);
  const chartRef = useRef<HTMLDivElement>(null);

  const money = (value: number) => `${formatNumber(value, language, 0)} ${quoteLabel}`;
  const ddLabel = `−${formatNumber(curve.maxDrawdownPct, language, 0)}%`;

  const series = useMemo(() => {
    const points = curve.points;
    return {
      equity: points.map((p) => ({ x: p[EQUITY_CURVE.time], y: p[EQUITY_CURVE.equity] > 0 ? p[EQUITY_CURVE.equity] : null })),
      buyHold: points.map((p) => ({ x: p[EQUITY_CURVE.time], y: p[EQUITY_CURVE.buyHold] > 0 ? p[EQUITY_CURVE.buyHold] : null })),
      // A queda em profundidade (positiva), para a área crescer de baixo para cima
      drawdown: points.map((p) => ({ x: p[EQUITY_CURVE.time], y: -p[EQUITY_CURVE.drawdownPct] })),
    };
  }, [curve]);

  const range = useMemo(() => {
    const values = curve.points.flatMap((p) => [p[EQUITY_CURVE.equity], p[EQUITY_CURVE.buyHold]]).filter((v) => v > 0);
    if (!values.length) return { min: undefined, max: undefined };
    return { min: Math.min(...values) * 0.85, max: Math.max(...values) * 1.15 };
  }, [curve]);

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
      const month = new Intl.DateTimeFormat(language, { month: 'short', year: '2-digit', timeZone: 'UTC' });
      const day = new Intl.DateTimeFormat(language, { day: '2-digit', month: '2-digit', year: 'numeric', timeZone: 'UTC' });
      const strategyName = t('trading.fsEquityStrategy', { value: money(curve.finalEquity) });
      const buyHoldName = t('trading.fsEquityBuyHold', { value: money(curve.finalBuyHold) });
      const drawdownName = t('trading.fsEquityDrawdown');

      chart = createLineChart(element, {
        xType: 'time',
        series: [
          // Pela ordem da legenda; a área do drawdown fica por baixo das linhas, no fundo
          { id: 'equity', name: strategyName, data: series.equity, color: token('chart-strategy'), width: 2 },
          { id: 'buyHold', name: buyHoldName, data: series.buyHold, color: token('chart-buy-hold'), width: 1.4, dash: [5, 4] },
          {
            id: 'drawdown',
            name: drawdownName,
            data: series.drawdown,
            color: token('chart-drawdown'),
            width: 0,
            area: { opacity: 0.55 },
            axis: 'right',
          },
        ],
        theme: lineTheme,
        padding: 4,
        legend: { show: true, position: 'top', align: 'start', marker: 'line', fontSize: 11.5 },
        xAxis: { grid: false, format: (x) => month.format(new Date(toMs(x))) },
        // Só o intervalo dos valores (com folga), para as linhas ocuparem a altura
        yAxis: { log: true, grid: true, min: range.min, max: range.max, format: (v) => formatNumber(v, language, 0) },
        y2Axis: { show: false, grid: false, min: 0, max: Math.max(curve.maxDrawdownPct, 1) * DRAWDOWN_SHARE },
        crosshair: { show: true },
        tooltip: {
          mode: 'shared',
          formatter: (ctx) => {
            const lines = ctx.points.map((point) => {
              const value =
                point.series.id === 'drawdown'
                  ? `${point.y ? '−' : ''}${formatNumber(Math.abs(point.y), language, 1)}%`
                  : money(point.y);
              const name = point.series.id === 'equity' ? t('trading.fsEquityStrategyShort') : point.series.id === 'buyHold' ? t('trading.fsEquityBuyHoldShort') : drawdownName;
              return `<span style="color:${point.color}">●</span> ${name}: <strong>${value}</strong>`;
            });
            return `<strong>${day.format(new Date(toMs(ctx.x)))}</strong><br>${lines.reverse().join('<br>')}`;
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
  }, [series, range, curve, language, t, theme, quoteLabel]);

  return (
    <Factsheet_Panel explain="sumEquity" title={t('trading.fsEquityTitle', { quote: quoteCode })} note={t('trading.fsEquityNote', { value: ddLabel })} panelRef={rootRef}>
      <div className="Factsheet_Chart Equity" ref={chartRef} />
    </Factsheet_Panel>
  );
};

export default Factsheet_Equity;

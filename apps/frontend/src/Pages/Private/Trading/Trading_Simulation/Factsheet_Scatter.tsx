import { useEffect, useMemo, useRef } from 'react';
import { useTranslation } from 'react-i18next';
import { createScatterChart } from 'openchartscandle/scatter';
import type { ScatterGraphicApi, ScatterTheme } from 'openchartscandle/scatter';
import 'openchartscandle/style.css';
import { useTheme } from '../../../../Contexts/ThemeContext';
import type { Chart_Returns_Scatter } from '../../../../Hooks/Trading/useSimulation';
import { formatNumber } from '../Trading_Simulator/format';
import Factsheet_Panel from './Factsheet_Panel';

interface Factsheet_Scatter_Props {
  curve: Chart_Returns_Scatter;
  asset: string;
}

// O canvas não lê variáveis CSS: as cores saem dos tokens já resolvidos
const tokenReader = (element: HTMLElement) => {
  const style = getComputedStyle(element);
  return (name: string) => style.getPropertyValue(`--factsheet-${name}`).trim();
};

/**
 * 1.6 — Retornos diários: ativo vs estratégia. Cada ponto é um dia (o retorno do
 * ativo em x, o da estratégia em y), com os eixos do 0 e a reta dos mínimos
 * quadrados a tracejado: a inclinação é o beta. Os dois eixos têm a mesma escala,
 * simétrica, para a inclinação se ler tal como é. Tudo vem calculado.
 */
const Factsheet_Scatter = ({ curve, asset }: Factsheet_Scatter_Props) => {
  const { t, i18n } = useTranslation();
  const language = i18n.language;
  const { theme } = useTheme();
  const rootRef = useRef<HTMLDivElement>(null);
  const chartRef = useRef<HTMLDivElement>(null);

  const percent = (value: number, digits = 1) => `${value < 0 ? '−' : ''}${formatNumber(Math.abs(value), language, digits)}%`;
  const number = (value: number | null) =>
    value == null ? '—' : `${value < 0 ? '−' : ''}${formatNumber(Math.abs(value), language, 2)}`;
  const day = useMemo(
    () => new Intl.DateTimeFormat(language, { day: '2-digit', month: '2-digit', year: 'numeric', timeZone: 'UTC' }),
    [language],
  );
  const range = curve.rangePct > 0 ? curve.rangePct : 1;
  const data = useMemo(() => curve.points.map(([x, y, time]) => ({ x, y, data: time })), [curve]);

  useEffect(() => {
    const element = chartRef.current;
    const root = rootRef.current;
    if (!element || !root) return;
    let chart: ReturnType<typeof createScatterChart> | null = null;
    // Na frame seguinte: o data-theme do <html> muda depois deste efeito
    const frame = requestAnimationFrame(() => {
      const token = tokenReader(root);
      const scatterTheme: Partial<ScatterTheme> = {
        background: 'transparent',
        text: token('chart-text'),
        muted: token('chart-muted'),
        grid: token('chart-grid'),
        axis: token('chart-axis'),
        tooltipBg: token('chart-tooltip-background'),
        tooltipText: token('chart-tooltip-text'),
        tooltipBorder: token('chart-tooltip-border'),
        font: getComputedStyle(document.body).fontFamily,
      };
      // Os eixos do 0, por baixo dos pontos
      const zeroLines = (ctx: CanvasRenderingContext2D, api: ScatterGraphicApi) => {
        ctx.save();
        ctx.strokeStyle = token('chart-axis');
        ctx.lineWidth = 1;
        ctx.beginPath();
        ctx.moveTo(Math.round(api.x(0)) + 0.5, api.plot.y);
        ctx.lineTo(Math.round(api.x(0)) + 0.5, api.plot.y + api.plot.h);
        ctx.moveTo(api.plot.x, Math.round(api.y(0)) + 0.5);
        ctx.lineTo(api.plot.x + api.plot.w, Math.round(api.y(0)) + 0.5);
        ctx.stroke();
        ctx.restore();
      };
      // A reta do beta, por cima dos pontos, de uma ponta à outra do eixo
      const betaLine = (ctx: CanvasRenderingContext2D, api: ScatterGraphicApi) => {
        if (curve.beta == null || curve.interceptPct == null) return;
        const at = (x: number) => (curve.interceptPct ?? 0) + (curve.beta ?? 0) * x;
        ctx.save();
        ctx.beginPath();
        ctx.rect(api.plot.x, api.plot.y, api.plot.w, api.plot.h);
        ctx.clip();
        ctx.strokeStyle = token('chart-regression');
        ctx.lineWidth = 2;
        ctx.setLineDash([8, 6]);
        ctx.beginPath();
        ctx.moveTo(api.x(-range), api.y(at(-range)));
        ctx.lineTo(api.x(range), api.y(at(range)));
        ctx.stroke();
        ctx.restore();
      };

      chart = createScatterChart(element, {
        series: [{ name: t('trading.fsScatterDays'), data, color: token('chart-strategy'), symbolSize: 6, opacity: 0.8, large: false }],
        theme: scatterTheme,
        padding: 4,
        legend: { show: false },
        xAxis: { show: false, grid: false, line: false, min: -range, max: range },
        yAxis: { show: false, grid: false, line: false, min: -range, max: range },
        underlay: zeroLines,
        graphic: betaLine,
        tooltip: {
          formatter: (point) => {
            const time = typeof point.data === 'number' ? day.format(new Date(point.data)) : '';
            return `<strong>${time}</strong><br>${asset}: <strong>${percent(Number(point.x), 2)}</strong><br>${t('trading.fsScatterStrategy')}: <strong>${percent(Number(point.y), 2)}</strong>`;
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
  }, [data, day, language, t, theme, range, curve.beta, curve.interceptPct, asset]);

  return (
    <Factsheet_Panel
      explain="sumScatter"
      title={t('trading.fsScatterTitle', { asset })}
      note={t('trading.fsScatterNote', { beta: number(curve.beta) })}
      panelRef={rootRef}
    >
      <div className="Factsheet_Chart Scatter" ref={chartRef} />
      <div className="Factsheet_Chart_Footer">
        <span>{`${asset} ${percent(-range)}`}</span>
        <span>0%</span>
        <span>{percent(range)}</span>
      </div>
    </Factsheet_Panel>
  );
};

export default Factsheet_Scatter;

import { useEffect, useMemo, useRef } from 'react';
import { useTranslation } from 'react-i18next';
import { createScatterChart } from 'openchartscandle/scatter';
import type { ScatterGraphicApi, ScatterTheme } from 'openchartscandle/scatter';
import 'openchartscandle/style.css';
import { useTheme } from '../../../../Contexts/ThemeContext';
import type { Mae_Scatter } from '../../../../Hooks/Trading/useSimulation';
import Factsheet_Panel from './Factsheet_Panel';
import { useFactsheetFormat } from './factsheetFormat';

interface Factsheet_Mae_Scatter_Props {
  scatter: Mae_Scatter;
}

// O canvas não lê variáveis CSS: as cores saem dos tokens já resolvidos
const tokenReader = (element: HTMLElement) => {
  const style = getComputedStyle(element);
  return (name: string) => style.getPropertyValue(`--factsheet-${name}`).trim();
};

/**
 * 4.5 — MAE vs resultado: um ponto por trade, a excursão adversa máxima em x
 * (do pior à esquerda até 0) e o resultado em y, azul os que ganharam e laranja
 * os que perderam, com as linhas do 0. O eixo do resultado vai até ao percentil 98
 * (vem calculado): os poucos trades acima ficam fora do desenho.
 */
const Factsheet_Mae_Scatter = ({ scatter }: Factsheet_Mae_Scatter_Props) => {
  const { t } = useTranslation();
  const { theme } = useTheme();
  const rootRef = useRef<HTMLDivElement>(null);
  const chartRef = useRef<HTMLDivElement>(null);
  const f = useFactsheetFormat('');

  const groups = useMemo(() => {
    const won = scatter.points.filter((point) => point[2]).map(([x, y]) => ({ x, y }));
    const lost = scatter.points.filter((point) => !point[2]).map(([x, y]) => ({ x, y }));
    return { won, lost };
  }, [scatter]);

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
      // As linhas do 0 (o resultado e a MAE), por baixo dos pontos
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

      chart = createScatterChart(element, {
        series: [
          { name: t('trading.fsMaeWon'), data: groups.won, color: token('chart-strategy'), symbolSize: 5, opacity: 0.85, large: false },
          { name: t('trading.fsMaeLost'), data: groups.lost, color: token('chart-drawdown'), symbolSize: 5, opacity: 0.85, large: false },
        ],
        theme: scatterTheme,
        padding: 4,
        // A legenda da biblioteca: um clique liga e desliga os que ganharam ou perderam
        legend: { show: true, position: 'top', align: 'start', interactive: true },
        xAxis: { show: false, grid: false, line: false, max: 0 },
        yAxis: { show: false, grid: false, line: false, min: scatter.resultMinPct, max: scatter.resultMaxPct },
        underlay: zeroLines,
        tooltip: {
          formatter: (point) =>
            `<strong>${point.series.name}</strong><br>${t('trading.fsMaeMae')}: <strong>${f.signedPercent(Number(point.x), 2)}</strong><br>${t('trading.fsMaeResult')}: <strong>${f.signedPercent(Number(point.y), 2)}</strong>`,
        },
        animation: { duration: 500 },
      });
    });
    return () => {
      cancelAnimationFrame(frame);
      chart?.destroy();
    };
    // f depende só da língua
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [groups, scatter.resultMinPct, scatter.resultMaxPct, f.language, t, theme]);

  return (
    <Factsheet_Panel title={t('trading.fsMaeTitle')} explain="entryMae" note={t('trading.fsMaeNote')} panelRef={rootRef}>
      <div className="Factsheet_Chart Distribution" ref={chartRef} />
      <div className="Factsheet_Chart_Footer">
        <span>{`MAE ${f.signedPercent(scatter.minMaePct, 1)}`}</span>
        <span>→ 0%</span>
        <span>{t('trading.fsMaeResultAxis')}</span>
      </div>
    </Factsheet_Panel>
  );
};

export default Factsheet_Mae_Scatter;

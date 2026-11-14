import { useEffect, useMemo, useRef } from 'react';
import { useTranslation } from 'react-i18next';
import { createLineChart } from 'openchartscandle/line';
import type { LineTheme } from 'openchartscandle/line';
import 'openchartscandle/style.css';
import { useTheme } from '../../../../Contexts/ThemeContext';
import type { Monte_Carlo_Fan } from '../../../../Hooks/Trading/useSimulation';
import Factsheet_Panel from './Factsheet_Panel';
import { resolveColor, resolveToken, useFactsheetFormat } from './factsheetFormat';

interface Factsheet_Monte_Carlo_Fan_Props {
  fan: Monte_Carlo_Fan;
}

// O eixo do tempo pode dar segundos ou milissegundos
const toMs = (x: number) => (x < 1e11 ? x * 1000 : x);

/**
 * 3.2 — O leque do Monte Carlo: o retorno acumulado (%) da mediana dos
 * caminhos com as faixas dos percentis 25–75 e 5–95, e o caminho real por
 * cima. Os percentis vêm calculados pelo simulador.
 */
const Factsheet_Monte_Carlo_Fan = ({ fan }: Factsheet_Monte_Carlo_Fan_Props) => {
  const { t, i18n } = useTranslation();
  const { theme } = useTheme();
  const f = useFactsheetFormat('');
  const rootRef = useRef<HTMLDivElement>(null);
  const chartRef = useRef<HTMLDivElement>(null);

  const series = useMemo(() => {
    const points = fan.points ?? [];
    const pick = (column: number) => points.map((p) => p[column]);
    return {
      x: points.map((p) => p[0]),
      p5: pick(1),
      p25: pick(2),
      p50: pick(3),
      p75: pick(4),
      p95: pick(5),
      real: pick(6),
    };
  }, [fan]);

  useEffect(() => {
    const element = chartRef.current;
    const root = rootRef.current;
    if (!element || !root || !series.x.length) return;
    let chart: ReturnType<typeof createLineChart> | null = null;
    // Na frame seguinte: o data-theme do <html> muda depois deste efeito
    const frame = requestAnimationFrame(() => {
      const token = (name: string) => resolveToken(root, name);
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
      const month = new Intl.DateTimeFormat(i18n.language, { month: 'short', year: '2-digit', timeZone: 'UTC' });
      const day = new Intl.DateTimeFormat(i18n.language, { day: '2-digit', month: '2-digit', year: 'numeric', timeZone: 'UTC' });
      const points = (values: number[]) => values.map((y, i) => ({ x: series.x[i], y }));
      const pathColor = token('chart-buy-hold');
      const fill = resolveColor(root, 'var(--factsheet-chart-buy-hold)');

      chart = createLineChart(element, {
        xType: 'time',
        series: [
          // A faixa de fora (5–95) numa linha invisível; a mediana leva a de dentro (25–75)
          {
            id: 'outer',
            name: t('trading.fsMcBandOuter'),
            data: points(series.p50),
            color: pathColor,
            width: 0,
            band: { lower: series.p5, upper: series.p95, color: fill, opacity: 0.12 },
          },
          {
            id: 'median',
            name: t('trading.fsMcMedian'),
            data: points(series.p50),
            color: pathColor,
            width: 1.4,
            dash: [5, 4],
            band: { lower: series.p25, upper: series.p75, color: fill, opacity: 0.22 },
          },
          { id: 'real', name: t('trading.fsMcReal'), data: points(series.real), color: token('chart-strategy'), width: 2 },
        ],
        theme: lineTheme,
        padding: 4,
        legend: { show: true, position: 'top', align: 'start', marker: 'line', fontSize: 11.5 },
        xAxis: { grid: false, format: (x) => month.format(new Date(toMs(Number(x)))) },
        yAxis: { grid: true, format: (v) => `${f.number(v, 0)}%` },
        crosshair: { show: true },
        tooltip: {
          mode: 'shared',
          formatter: (ctx) => {
            // O x do tooltip vem em segundos; os pontos estão em ms
            const i = series.x.indexOf(toMs(Number(ctx.x)));
            if (i < 0) return '';
            const row = (label: string, value: number) => `${label}: <strong>${f.signedPercent(value, 1)}</strong>`;
            return [
              `<strong>${day.format(new Date(toMs(series.x[i])))}</strong>`,
              row(t('trading.fsMcReal'), series.real[i]),
              row('P95', series.p95[i]),
              row('P75', series.p75[i]),
              row(t('trading.fsMcMedian'), series.p50[i]),
              row('P25', series.p25[i]),
              row('P5', series.p5[i]),
            ].join('<br>');
          },
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
  }, [series, t, i18n.language, theme]);

  return (
    <Factsheet_Panel
      title={t('trading.fsMcFanTitle')}
      explain="proofMcFan"
      note={t('trading.fsMcFanNote', { paths: f.number(fan.paths), days: fan.blockDays })}
      panelRef={rootRef}
    >
      <div className="Factsheet_Chart Equity" ref={chartRef} />
    </Factsheet_Panel>
  );
};

export default Factsheet_Monte_Carlo_Fan;

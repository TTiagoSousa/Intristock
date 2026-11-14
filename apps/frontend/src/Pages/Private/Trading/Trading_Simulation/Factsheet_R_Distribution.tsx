import { useEffect, useRef } from 'react';
import { useTranslation } from 'react-i18next';
import { createBarChart } from 'openchartscandle/bar';
import type { BarItem, BarTheme } from 'openchartscandle/bar';
import 'openchartscandle/style.css';
import { useTheme } from '../../../../Contexts/ThemeContext';
import type { R_Distribution } from '../../../../Hooks/Trading/useSimulation';
import Factsheet_Panel from './Factsheet_Panel';
import { useFactsheetFormat } from './factsheetFormat';

interface Factsheet_R_Distribution_Props {
  distribution: R_Distribution;
}

// O canvas não lê variáveis CSS: as cores saem dos tokens já resolvidos
const tokenReader = (element: HTMLElement) => {
  const style = getComputedStyle(element);
  return (name: string) => style.getPropertyValue(`--factsheet-${name}`).trim();
};

/**
 * 4.5 — Resultado por trade em R: quantos trades caem em cada barra de R
 * (laranja abaixo de 0, azul acima). As barras vêm calculadas; os trades sem
 * stop não têm R e dizem-se por baixo.
 */
const Factsheet_R_Distribution = ({ distribution }: Factsheet_R_Distribution_Props) => {
  const { t } = useTranslation();
  const { theme } = useTheme();
  const rootRef = useRef<HTMLDivElement>(null);
  const chartRef = useRef<HTMLDivElement>(null);
  const f = useFactsheetFormat('');
  const r = (value: number) => `${f.signed(value, 2)}R`;
  const bins = distribution.bins;
  // Trades para lá das pontas (o histograma vai de −3 a +6R; os outros ficam nas barras das pontas)
  const overHigh = bins.length > 0 && distribution.maxR != null && distribution.maxR > bins[bins.length - 1].to;
  const overLow = bins.length > 0 && distribution.minR != null && distribution.minR < bins[0].from;

  useEffect(() => {
    const element = chartRef.current;
    const root = rootRef.current;
    if (!element || !root || !distribution.bins.length) return;
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

      const last = distribution.bins.length - 1;
      chart = createBarChart(element, {
        // As barras das pontas juntam os trades para lá do limite
        categories: distribution.bins.map((bin, i) =>
          i === last && overHigh
            ? `≥ ${r(bin.from)}`
            : i === 0 && overLow
              ? `≤ ${r(bin.to)}`
              : t('trading.fsRDistRange', { from: r(bin.from), to: r(bin.to) }),
        ),
        series: [
          {
            id: 'trades',
            name: t('trading.fsRDistTrades'),
            data: distribution.bins.map((bin): BarItem => ({ value: bin.count, color: bin.from + bin.to < 0 ? down : up })),
          },
        ],
        theme: barTheme,
        padding: 4,
        categoryGap: 0.12,
        radius: 2,
        legend: { show: false },
        categoryAxis: { show: false, grid: false },
        valueAxis: { show: false, grid: false, min: 0 },
        tooltip: { mode: 'shared' },
        animation: { duration: 500 },
      });
    });
    return () => {
      cancelAnimationFrame(frame);
      chart?.destroy();
    };
    // r depende só da língua
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [distribution, overHigh, overLow, f.language, t, theme]);

  return (
    <Factsheet_Panel title={t('trading.fsRDistTitle')} explain="entryRDist" note={t('trading.fsRDistNote')} panelRef={rootRef}>
      {bins.length ? (
        <>
          <div className="Factsheet_Chart Distribution" ref={chartRef} />
          <div className="Factsheet_Chart_Footer">
            <span>{overLow ? `≤ ${r(bins[0].to)}` : r(bins[0].from)}</span>
            <span>0R</span>
            <span>{overHigh ? `≥ ${r(bins[bins.length - 1].from)}` : r(bins[bins.length - 1].to)}</span>
          </div>
          {distribution.withoutStop > 0 && (
            <span className="Factsheet_Chart_Footer">{t('trading.fsRDistWithoutStop', { count: distribution.withoutStop })}</span>
          )}
        </>
      ) : (
        <span className="Factsheet_Hint">{t('trading.fsRDistEmpty')}</span>
      )}
    </Factsheet_Panel>
  );
};

export default Factsheet_R_Distribution;

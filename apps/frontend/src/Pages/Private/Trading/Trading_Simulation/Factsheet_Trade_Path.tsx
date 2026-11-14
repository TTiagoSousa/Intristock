import { useEffect, useMemo, useRef } from 'react';
import { useTranslation } from 'react-i18next';
import { createLineChart } from 'openchartscandle/line';
import type { LineTheme } from 'openchartscandle/line';
import 'openchartscandle/style.css';
import { useTheme } from '../../../../Contexts/ThemeContext';
import type { Trade_Path } from '../../../../Hooks/Trading/useSimulation';
import Factsheet_Panel from './Factsheet_Panel';
import { resolveToken, useFactsheetFormat } from './factsheetFormat';

interface Factsheet_Trade_Path_Props {
  path: Trade_Path;
}

/**
 * 4.8 — Caminho médio do trade (em R) desde a entrada: em cada vela, o R médio
 * dos trades que acabaram a ganhar, dos que acabaram a perder e de todos (a
 * tracejado), com a linha do 0 e a vela em que as curvas se separam. A legenda
 * (da biblioteca) liga e desliga cada curva. Os pontos vêm calculados.
 */
const Factsheet_Trade_Path = ({ path }: Factsheet_Trade_Path_Props) => {
  const { t } = useTranslation();
  const { theme } = useTheme();
  const f = useFactsheetFormat('');
  const rootRef = useRef<HTMLDivElement>(null);
  const chartRef = useRef<HTMLDivElement>(null);

  const series = useMemo(
    () => ({
      winners: path.points.flatMap(([x, y]) => (y == null ? [] : [{ x, y }])),
      losers: path.points.flatMap(([x, , y]) => (y == null ? [] : [{ x, y }])),
      all: path.points.map(([x, , , y]) => ({ x, y })),
    }),
    [path],
  );
  const last = path.points[path.points.length - 1];

  useEffect(() => {
    const element = chartRef.current;
    const root = rootRef.current;
    if (!element || !root || !path.points.length) return;
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
      const r = (value: number) => `${f.signed(value, 2)}R`;

      chart = createLineChart(element, {
        xType: 'number',
        series: [
          { id: 'winners', name: t('trading.fsPathWinners'), data: series.winners, color: token('chart-strategy'), width: 1.8 },
          { id: 'losers', name: t('trading.fsPathLosers'), data: series.losers, color: token('chart-drawdown'), width: 1.8 },
          { id: 'all', name: t('trading.fsPathAll'), data: series.all, color: token('chart-normal'), width: 1.4, dash: [4, 4] },
        ],
        theme: lineTheme,
        padding: 4,
        legend: { show: true, position: 'top', align: 'start', marker: 'line', fontSize: 11.5 },
        xAxis: { show: false, grid: false },
        yAxis: { show: false, grid: false },
        annotations: {
          y: [{ value: 0, color: token('chart-axis') }],
          x: path.separationBar != null ? [{ value: path.separationBar, color: token('chart-muted'), dash: [3, 4] }] : [],
        },
        crosshair: { show: true },
        tooltip: {
          mode: 'shared',
          formatter: (ctx) => {
            const rows = ctx.points
              .map((point) => `<span style="color:${point.color}">●</span> ${point.series.name}: <strong>${r(point.y)}</strong>`)
              .join('<br>');
            return `<strong>${t('trading.fsPathBar', { value: ctx.x })}</strong><br>${rows}`;
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
  }, [series, path, t, f.language, theme]);

  return (
    <Factsheet_Panel title={t('trading.fsPathTitle')} explain="entryTradePath" note={t('trading.fsPathNote')} panelRef={rootRef}>
      {path.points.length ? (
        <>
          <div className="Factsheet_Chart Trade_Path" ref={chartRef} />
          <div className="Factsheet_Chart_Footer">
            <span>{t('trading.fsPathBar', { value: 0 })}</span>
            <span>
              {path.separationBar == null
                ? t('trading.fsPathNoSeparation', { value: f.number(path.separationR, 1) })
                : t('trading.fsPathSeparation', { value: path.separationBar })}
            </span>
            <span>{last ? `${t('trading.fsPathBar', { value: last[0] })} · ${f.signed(last[3], 2)}R` : ''}</span>
          </div>
        </>
      ) : (
        <span className="Factsheet_Hint">{t('trading.fsPathEmpty')}</span>
      )}
    </Factsheet_Panel>
  );
};

export default Factsheet_Trade_Path;

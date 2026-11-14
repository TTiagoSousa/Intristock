import { useEffect, useMemo, useRef } from 'react';
import { useTranslation } from 'react-i18next';
import { createLineChart } from 'openchartscandle/line';
import type { LineTheme } from 'openchartscandle/line';
import 'openchartscandle/style.css';
import { useTheme } from '../../../../Contexts/ThemeContext';
import type { Chart_Rolling_Sharpe } from '../../../../Hooks/Trading/useSimulation';
import { formatNumber } from '../Trading_Simulator/format';
import Factsheet_Panel from './Factsheet_Panel';

interface Factsheet_Rolling_Sharpe_Props {
  curve: Chart_Rolling_Sharpe;
}

// As linhas de referência: sem edge, bom e muito bom
const REFERENCES = [0, 1, 2];

// O canvas não lê variáveis CSS: as cores saem dos tokens já resolvidos
const tokenReader = (element: HTMLElement) => {
  const style = getComputedStyle(element);
  return (name: string) => style.getPropertyValue(`--factsheet-${name}`).trim();
};

// O eixo do tempo pode dar segundos ou milissegundos
const toMs = (x: number) => (x < 1e11 ? x * 1000 : x);

/**
 * 1.3 — Sharpe em janela móvel: em cada dia, o Sharpe dos últimos N dias, com as
 * linhas de referência em 0, 1 e 2. Os dias sem Sharpe (sem oscilação na janela)
 * ficam em branco. Os pontos vêm já calculados.
 */
const Factsheet_Rolling_Sharpe = ({ curve }: Factsheet_Rolling_Sharpe_Props) => {
  const { t, i18n } = useTranslation();
  const language = i18n.language;
  const { theme } = useTheme();
  const rootRef = useRef<HTMLDivElement>(null);
  const chartRef = useRef<HTMLDivElement>(null);

  const number = (value: number | null) =>
    value == null ? '—' : `${value < 0 ? '−' : ''}${formatNumber(Math.abs(value), language, 2)}`;
  const day = useMemo(
    () => new Intl.DateTimeFormat(language, { day: '2-digit', month: '2-digit', year: 'numeric', timeZone: 'UTC' }),
    [language],
  );
  const data = useMemo(() => curve.points.map(([x, y]) => ({ x, y })), [curve]);
  const first = curve.points[0]?.[0];
  const last = curve.points[curve.points.length - 1]?.[0];

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
        series: [{ id: 'sharpe', name: t('trading.fsRollingSharpeName'), data, color: token('chart-strategy'), width: 1.4 }],
        theme: lineTheme,
        padding: 4,
        legend: { show: false },
        xAxis: { show: false, grid: false },
        // Os números das referências à esquerda, para se ler a altura da linha
        yAxis: { grid: false, ticks: 6, format: (v) => number(v) },
        // Sem rótulo: as três ficam juntas na escala e o eixo já tem os números
        annotations: {
          y: REFERENCES.map((value) => ({
            value,
            color: token(value === 0 ? 'chart-axis' : 'chart-muted'),
            dash: value === 0 ? undefined : [4, 4],
          })),
        },
        crosshair: { show: true },
        tooltip: {
          mode: 'shared',
          formatter: (ctx) => {
            const point = ctx.points[0];
            if (!point) return '';
            return `<strong>${day.format(new Date(toMs(ctx.x)))}</strong><br><span style="color:${point.color}">●</span> ${t('trading.fsRollingSharpeName')}: <strong>${number(point.y)}</strong>`;
          },
        },
        animation: { duration: 500 },
      });
    });
    return () => {
      cancelAnimationFrame(frame);
      chart?.destroy();
    };
    // number depende só da língua
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [data, day, language, t, theme]);

  return (
    <Factsheet_Panel explain="sumRollingSharpe" title={t('trading.fsRollingSharpeTitle', { days: curve.windowDays })} note={t('trading.fsRollingSharpeNote')} panelRef={rootRef}>
      <div className="Factsheet_Chart Rolling_Sharpe" ref={chartRef} />
      <div className="Factsheet_Chart_Footer">
        <span>{first != null ? day.format(new Date(first)) : ''}</span>
        <span>{t('trading.fsRollingSharpeRange', { min: number(curve.min), max: number(curve.max) })}</span>
        <span>{last != null ? day.format(new Date(last)) : ''}</span>
      </div>
    </Factsheet_Panel>
  );
};

export default Factsheet_Rolling_Sharpe;

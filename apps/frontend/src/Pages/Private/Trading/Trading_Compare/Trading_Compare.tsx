import { useEffect, useMemo, useRef, useState } from 'react';
import { useNavigate, useSearchParams } from 'react-router-dom';
import { useTranslation } from 'react-i18next';
import { createLineChart } from 'openchartscandle/line';
import type { LineTheme } from 'openchartscandle/line';
import 'openchartscandle/style.css';
import { useTheme } from '../../../../Contexts/ThemeContext';
import http from '../../../../Service/httpService';
import { End_Points } from '../../../../Service/endPoints';
import type { Report_Block, Simulation_Report, Simulation_Run } from '../../../../Hooks/Trading/useSimulation';
import { COMPARE_MAX } from '../../../../Hooks/Trading/useSimulations';
import Simple_Button from '../../../../Components/Buttons/Simple_Button/Simple_Button';
import Factsheet_Panel from '../Trading_Simulation/Factsheet_Panel';
import { entryColor, moneyUnit, resolveToken, useFactsheetFormat } from '../Trading_Simulation/factsheetFormat';
import { formatDay } from '../Trading_Simulator/format';
import '../Trading_Simulation/Run_Summary.scss';
import './Trading_Compare.scss';

const COMPARE_BLOCKS: Report_Block[] = [
  'summaryMetrics',
  'strategyScore',
  'sampleSplit',
  'performanceCurve',
  'monteCarloCards',
  'walkForwardCards',
  'costStress',
  'verdicts',
];

interface Compared {
  run: Simulation_Run;
  report: Simulation_Report | null;
}

// Uma linha da tabela: o valor de cada simulação, como se escreve e o que é melhor
interface Metric_Row {
  key: string;
  values: (number | null)[];
  format: (value: number | null) => string;
  // 'high': maior é melhor; 'low': menor é melhor; null: só se mostra
  better: 'high' | 'low' | null;
}

// O eixo do tempo pode dar segundos ou milissegundos
const toMs = (x: number) => (x < 1e11 ? x * 1000 : x);

/**
 * Comparar simulações (`?ids=a,b,c`, até `COMPARE_MAX`): o retorno acumulado
 * de cada uma no mesmo gráfico (o índice de performance, sem depósitos) e uma
 * tabela das métricas lado a lado, com a melhor de cada linha marcada, e o
 * veredicto de cada uma. Os números vêm todos do simulador (os blocos do
 * relatório de cada simulação).
 */
const Trading_Compare = () => {
  const { t, i18n } = useTranslation();
  const navigate = useNavigate();
  const { theme } = useTheme();
  const [params] = useSearchParams();
  const ids = useMemo(
    () => [...new Set((params.get('ids') ?? '').split(',').filter(Boolean))].slice(0, COMPARE_MAX),
    [params],
  );
  const [state, setState] = useState<{ key: string; items: Compared[] } | null>(null);
  const key = ids.join(',');
  const items = state?.key === key ? state.items : null;
  const rootRef = useRef<HTMLDivElement>(null);
  const chartRef = useRef<HTMLDivElement>(null);
  const f = useFactsheetFormat('');

  useEffect(() => {
    let cancelled = false;
    Promise.all(
      ids.map(async (id) => {
        try {
          const [run, report] = await Promise.all([
            http.get<Simulation_Run>(End_Points.Simulation_Endpoint(id)),
            http
              .get<Simulation_Report>(End_Points.Simulation_Report_Endpoint(id), { params: { blocks: COMPARE_BLOCKS.join(',') } })
              .then((response) => response.data)
              .catch(() => null),
          ]);
          return { run: run.data, report };
        } catch {
          return null;
        }
      }),
    ).then((loaded) => {
      if (!cancelled) setState({ key, items: loaded.filter((item): item is Compared => item !== null) });
    });
    return () => {
      cancelled = true;
    };
    // A chave junta os ids
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [key]);

  const label = (run: Simulation_Run) =>
    `${run.instrument.asset.ticker ?? run.instrument.symbol}/${run.instrument.quote} · ${t(`trading.tf_${run.timeframe}`)}`;

  // As curvas: o retorno acumulado de cada uma
  useEffect(() => {
    const element = chartRef.current;
    const root = rootRef.current;
    if (!element || !root || !items?.length) return;
    let chart: ReturnType<typeof createLineChart> | null = null;
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
      chart = createLineChart(element, {
        xType: 'time',
        series: items.map((item, index) => ({
          id: item.run.id,
          name: `${index + 1}. ${label(item.run)}`,
          data: (item.report?.performanceCurve?.points ?? []).map(([x, y]) => ({ x, y })),
          color: token(`entry-${entryColor(index + 1)}`),
          width: 1.8,
        })),
        theme: lineTheme,
        padding: 4,
        legend: { show: true, position: 'top', align: 'start', marker: 'line', fontSize: 11.5 },
        xAxis: { grid: false, format: (x) => month.format(new Date(toMs(Number(x)))) },
        yAxis: { grid: true, format: (v) => `${f.number(v, 0)}%` },
        crosshair: { show: true },
        tooltip: {
          mode: 'shared',
          formatter: (ctx) =>
            `<strong>${day.format(new Date(toMs(Number(ctx.x))))}</strong><br>` +
            ctx.points
              .map((point) => `<span style="color:${point.color}">●</span> ${point.series.name}: <strong>${f.signedPercent(point.y, 1)}</strong>`)
              .join('<br>'),
        },
        animation: { duration: 500 },
      });
    });
    return () => {
      cancelAnimationFrame(frame);
      chart?.destroy();
    };
    // f e o nome dependem só da língua
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [items, i18n.language, theme]);

  const rows = useMemo<Metric_Row[]>(() => {
    if (!items) return [];
    const pick = (read: (item: Compared) => number | null | undefined) => items.map((item) => read(item) ?? null);
    const outside = (item: Compared) => item.report?.sampleSplit?.rows.find((row) => row.key === 'annualReturnPct')?.outside;
    const pct = (value: number | null) => f.signedPercent(value, 1);
    const plain = (digits: number) => (value: number | null) => f.number(value, digits);
    return [
      { key: 'netProfitPct', values: pick((i) => i.report?.summaryMetrics?.netProfitPct), format: pct, better: 'high' },
      { key: 'cagrPct', values: pick((i) => i.report?.summaryMetrics?.cagrPct), format: pct, better: 'high' },
      { key: 'buyHoldPct', values: pick((i) => i.report?.summaryMetrics?.buyHoldPct), format: pct, better: null },
      { key: 'sharpe', values: pick((i) => i.report?.summaryMetrics?.sharpe), format: plain(2), better: 'high' },
      { key: 'sortino', values: pick((i) => i.report?.summaryMetrics?.sortino), format: plain(2), better: 'high' },
      { key: 'maxDrawdownPct', values: pick((i) => i.report?.summaryMetrics?.maxDrawdownPct), format: (v) => (v == null ? '—' : `−${f.number(v, 1)}%`), better: 'low' },
      { key: 'calmar', values: pick((i) => i.report?.summaryMetrics?.calmar), format: plain(2), better: 'high' },
      { key: 'trades', values: pick((i) => i.report?.summaryMetrics?.trades), format: plain(0), better: null },
      { key: 'winRatePct', values: pick((i) => i.report?.summaryMetrics?.winRatePct), format: (v) => f.percent(v, 1), better: 'high' },
      { key: 'profitFactor', values: pick((i) => i.report?.summaryMetrics?.profitFactor), format: plain(2), better: 'high' },
      { key: 'score', values: pick((i) => i.report?.strategyScore?.value), format: plain(0), better: 'high' },
      { key: 'outAnnualPct', values: pick(outside), format: pct, better: 'high' },
      { key: 'mcLossPct', values: pick((i) => i.report?.monteCarloCards?.lossPct), format: (v) => f.percent(v, 1), better: 'low' },
      { key: 'mcDrawdownP95', values: pick((i) => i.report?.monteCarloCards?.drawdownP95), format: (v) => (v == null ? '—' : `−${f.number(v, 1)}%`), better: 'low' },
      { key: 'wfPositive', values: pick((i) => i.report?.walkForwardCards?.positiveWindows), format: plain(0), better: 'high' },
      { key: 'costBreakeven', values: pick((i) => i.report?.costStress?.breakEvenFeeMult), format: (v) => (v == null ? '—' : `×${f.number(v, 2)}`), better: 'high' },
    ];
    // f depende só da língua
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [items, f.language]);

  // A melhor de cada linha (só com mais de uma com valor)
  const bestOf = (row: Metric_Row) => {
    const known = row.values.filter((value): value is number => value != null);
    if (!row.better || known.length < 2) return null;
    return row.better === 'high' ? Math.max(...known) : Math.min(...known);
  };

  return (
    <div className="Trading_Compare">
      <div className="Page_Card">
        <div className="Card_Header">
          <div className="Card_Header_Text">
            <span className="Card_Title">{t('trading.compareTitle')}</span>
            <span className="Card_Subtitle">{t('trading.compareSubtitle', { count: ids.length })}</span>
          </div>
          <div className="Card_Header_Action">
            <Simple_Button text={t('trading.compareBack')} small variant="Ghost" onClick={() => navigate('/Trading/simulacoes')} />
          </div>
        </div>
        {ids.length < 2 ? (
          <span className="Empty_Message">{t('trading.compareTooFew')}</span>
        ) : !items ? (
          <span className="Empty_Message">{t('common.loading')}</span>
        ) : (
          <div className="Run_Summary Trading_Compare_Body">
            <div className="Trading_Compare_Runs">
              {items.map((item, index) => (
                <button
                  key={item.run.id}
                  type="button"
                  className="Trading_Compare_Run"
                  onClick={() => navigate(`/Trading/simulacoes/${item.run.id}`)}
                >
                  <span className={`Factsheet_By_Entry_Dot Color_${entryColor(index + 1)}`} />
                  <span className="Trading_Compare_Run_Name">
                    {index + 1}. {label(item.run)}
                  </span>
                  <span className="Trading_Compare_Run_Detail">
                    {formatDay(item.run.fromDate, i18n.language)} – {formatDay(item.run.toDate, i18n.language)} · {moneyUnit(item.run.instrument.quote)}
                  </span>
                </button>
              ))}
            </div>
            <Factsheet_Panel title={t('trading.compareChartTitle')} note={t('trading.compareChartNote')} panelRef={rootRef}>
              <div className="Factsheet_Chart Equity" ref={chartRef} />
            </Factsheet_Panel>
            <Factsheet_Panel title={t('trading.compareTableTitle')} note={t('trading.compareTableNote')}>
              <div className="Factsheet_Table_Scroll">
                <table className="Factsheet_Table">
                  <thead>
                    <tr>
                      <th>{t('trading.compareCol_metric')}</th>
                      {items.map((item, index) => (
                        <th key={item.run.id} className="Numeric">
                          <span className="Trading_Compare_Head">
                            <span className={`Factsheet_By_Entry_Dot Color_${entryColor(index + 1)}`} />
                            {index + 1}
                          </span>
                        </th>
                      ))}
                    </tr>
                  </thead>
                  <tbody>
                    {rows.map((row) => {
                      const best = bestOf(row);
                      return (
                        <tr key={row.key}>
                          <td className="Strong">{t(`trading.compareRow_${row.key}`)}</td>
                          {row.values.map((value, index) => (
                            <td key={index} className={`Numeric${value != null && value === best ? ' Strong Positive' : ''}`}>
                              {row.format(value)}
                            </td>
                          ))}
                        </tr>
                      );
                    })}
                    <tr>
                      <td className="Strong">{t('trading.compareRow_verdict')}</td>
                      {items.map((item) => {
                        const overall = item.report?.verdicts?.overall;
                        return (
                          <td key={item.run.id} className="Numeric">
                            {overall ? (
                              <span className={`Factsheet_Verdict_Tag ${overall}`}>{t(`trading.fsVerdict_${overall}`)}</span>
                            ) : (
                              '—'
                            )}
                          </td>
                        );
                      })}
                    </tr>
                  </tbody>
                </table>
              </div>
            </Factsheet_Panel>
          </div>
        )}
      </div>
    </div>
  );
};

export default Trading_Compare;

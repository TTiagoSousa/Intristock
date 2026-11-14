import { useTranslation } from 'react-i18next';
import type {
  Cost_Stress,
  Entry_Payload,
  Regime_Grid,
  Regime_Row,
  Regime_Table,
  Sensitivity_Params,
  Walk_Forward,
} from '../../../../Hooks/Trading/useSimulation';
import { formatDay } from '../Trading_Simulator/format';
import Factsheet_Panel from './Factsheet_Panel';
import { useVerdictFormat } from './verdictFormat';

// 3.3 a 3.6 — As tabelas da robustez; tudo vem calculado pelo simulador

// A cor mais forte de uma célula (em % da cor do token, sobre o fundo)
const TINT_MAX = 70;

// A cor de uma célula pelo valor (azul a ganhar, laranja a perder), até ao maior em módulo
const tintOf = (value: number | null, largest: number) => {
  if (value == null || !largest) return undefined;
  const share = Math.round((Math.min(Math.abs(value), largest) / largest) * TINT_MAX);
  const token = value < 0 ? 'cell-negative' : 'cell-positive';
  return `color-mix(in srgb, var(--factsheet-${token}) ${share}%, var(--factsheet-cell-empty))`;
};

// O nome de uma variante do walk-forward: 'current' ou '<parâmetro>@<passo>'
const useVariantLabel = (sensitivity: Sensitivity_Params | null, entries: Entry_Payload[], unit: string) => {
  const { t } = useTranslation();
  const { f, paramLabel, paramValue } = useVerdictFormat(entries, unit);
  return (key: string | null) => {
    if (!key) return '—';
    if (key === 'current') return t('trading.fsWfCurrent');
    const [param, step] = key.split('@');
    const row = sensitivity?.rows.find((item) => item.key === param);
    if (!row) return key;
    const own = row.steps.find((item) => String(item.step) === step);
    return `${paramLabel(row)} ${paramValue(row, own?.value ?? row.value)} (×${f.number(Number(step), 1)})`;
  };
};

interface Walk_Forward_Props {
  table: Walk_Forward;
  sensitivity: Sensitivity_Params | null;
  entries: Entry_Payload[];
  unit: string;
}

// 3.3 — As janelas: a estratégia como está, o comprar e manter, a variante escolhida na anterior e a melhor desta
export const Factsheet_Walk_Forward = ({ table, sensitivity, entries, unit }: Walk_Forward_Props) => {
  const { t, i18n } = useTranslation();
  const { f } = useVerdictFormat(entries, unit);
  const label = useVariantLabel(sensitivity, entries, unit);
  return (
    <Factsheet_Panel title={t('trading.fsWfTableTitle')} explain="proofWfTable" note={t('trading.fsWfTableNote')}>
      <div className="Factsheet_Table_Scroll">
        <table className="Factsheet_Table">
          <thead>
            <tr>
              <th>{t('trading.fsWfCol_window')}</th>
              <th className="Numeric">{t('trading.fsWfCol_return')}</th>
              <th className="Numeric">{t('trading.fsWfCol_buyHold')}</th>
              <th className="Numeric">{t('trading.fsWfCol_drawdown')}</th>
              <th className="Numeric">{t('trading.fsHourCol_trades')}</th>
              <th>{t('trading.fsWfCol_chosen')}</th>
              <th className="Numeric">{t('trading.fsWfCol_chosenReturn')}</th>
              <th>{t('trading.fsWfCol_best')}</th>
              <th className="Numeric">{t('trading.fsWfCol_bestReturn')}</th>
            </tr>
          </thead>
          <tbody>
            {(table.rows ?? []).map((row) => (
              <tr key={row.window}>
                <td className="Strong">
                  {t('trading.fsWfWindow', { window: row.window })}
                  <span className="Factsheet_Cell_Detail">
                    {formatDay(new Date(row.from).toISOString(), i18n.language)} – {formatDay(new Date(row.to).toISOString(), i18n.language)}
                  </span>
                </td>
                <td className={`Numeric Strong ${f.tone(row.returnPct)}`}>{f.signedPercent(row.returnPct)}</td>
                <td className={`Numeric ${f.tone(row.buyHoldPct)}`}>{f.signedPercent(row.buyHoldPct)}</td>
                <td className="Numeric Negative">{f.signedPercent(row.drawdownPct)}</td>
                <td className="Numeric">{f.number(row.trades)}</td>
                <td className="Factsheet_Table_Wrap">{row.window === 1 ? t('trading.fsWfFirst') : label(row.chosenKey)}</td>
                <td className={`Numeric Strong ${f.tone(row.chosenReturnPct)}`}>{f.signedPercent(row.chosenReturnPct)}</td>
                <td className="Factsheet_Table_Wrap">{label(row.bestKey)}</td>
                <td className={`Numeric ${f.tone(row.bestReturnPct)}`}>{f.signedPercent(row.bestReturnPct)}</td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    </Factsheet_Panel>
  );
};

interface Sensitivity_Props {
  table: Sensitivity_Params;
  entries: Entry_Payload[];
  unit: string;
}

// 3.4 — Cada parâmetro com o retorno (e o de fora da amostra) em cada passo; a cor é o retorno
export const Factsheet_Sensitivity_Table = ({ table, entries, unit }: Sensitivity_Props) => {
  const { t } = useTranslation();
  const { f, paramLabel, paramValue } = useVerdictFormat(entries, unit);
  const largest = Math.max(
    1,
    Math.abs(table.current.returnPct),
    ...table.rows.flatMap((row) => row.steps.map((step) => Math.abs(step.returnPct))),
  );
  const columns = [...table.steps.filter((step) => step < 1), 1, ...table.steps.filter((step) => step > 1)];
  return (
    <Factsheet_Panel title={t('trading.fsSensTableTitle')} explain="proofSensTable" note={t('trading.fsSensTableNote')}>
      <div className="Factsheet_Table_Scroll">
        <table className="Factsheet_Table Factsheet_Entry_Blocks">
          <thead>
            <tr>
              <th>{t('trading.fsSensCol_param')}</th>
              {columns.map((step) => (
                <th key={step} className="Centered">
                  {step === 1 ? t('trading.fsSensCurrent') : `×${f.number(step, 1)}`}
                </th>
              ))}
              <th className="Numeric">{t('trading.fsSensCol_spread')}</th>
              <th className="Numeric">{t('trading.fsSensCol_positive')}</th>
            </tr>
          </thead>
          <tbody>
            {table.rows.map((row) => (
              <tr key={row.key}>
                <td className="Strong">
                  {paramLabel(row)}
                  <span className="Factsheet_Cell_Detail">{paramValue(row, row.value)}</span>
                </td>
                {columns.map((step) => {
                  const own = step === 1 ? { ...table.current, value: row.value } : row.steps.find((item) => item.step === step);
                  if (!own) return <td key={step} />;
                  return (
                    <td
                      key={step}
                      className={`Factsheet_Entry_Block${step === 1 ? ' Current' : ''}`}
                      style={{ backgroundColor: tintOf(own.returnPct, largest) }}
                      title={t('trading.fsSensCell', {
                        value: paramValue(row, own.value),
                        trades: f.number(own.trades),
                        drawdown: f.signedPercent(own.maxDrawdownPct),
                      })}
                    >
                      <strong>{f.signedPercent(own.returnPct)}</strong>
                      <span>
                        {paramValue(row, own.value)} · {t('trading.fsSensOut', { value: f.signedPercent(own.outReturnPct) })}
                      </span>
                    </td>
                  );
                })}
                <td className="Numeric">{t('trading.fsFilterPoints', { value: f.number(row.spreadPct, 1) })}</td>
                <td className="Numeric">{f.percent(row.positivePct, 0)}</td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    </Factsheet_Panel>
  );
};

interface Cost_Props {
  table: Cost_Stress;
  unit: string;
}

// 3.5 — A estratégia com os custos mais altos
export const Factsheet_Cost_Stress = ({ table, unit }: Cost_Props) => {
  const { t } = useTranslation();
  const { f } = useVerdictFormat([], unit);
  const rows = [{ variant: 'current' as const, feeMult: 1, slippageAdd: 0, deltaPct: 0, ...table.current }, ...table.rows];
  return (
    <Factsheet_Panel
      title={t('trading.fsCostTitle')}
      explain="proofCostStress"
      note={t('trading.fsCostNote', {
        entry: f.percent(table.feeEntryPct, 3),
        exit: f.percent(table.feeExitPct, 3),
        slippage: f.percent(table.slippagePct, 3),
      })}
    >
      <div className="Factsheet_Table_Scroll">
        <table className="Factsheet_Table">
          <thead>
            <tr>
              <th>{t('trading.fsCostCol_variant')}</th>
              <th className="Numeric">{t('trading.fsCostCol_fees')}</th>
              <th className="Numeric">{t('trading.fsFiltersCol_return')}</th>
              <th className="Numeric">{t('trading.fsFiltersCol_delta')}</th>
              <th className="Numeric">{t('trading.fsFiltersCol_maxDd')}</th>
              <th className="Numeric">{t('trading.fsCostCol_pf')}</th>
              <th className="Numeric">{t('trading.fsFiltersCol_outside')}</th>
            </tr>
          </thead>
          <tbody>
            {rows.map((row) => (
              <tr key={row.variant} className={row.variant === 'current' ? 'Total' : ''}>
                <td className="Strong">{t(`trading.fsCost_${row.variant}`)}</td>
                <td className="Numeric">{f.money(-row.fees)}</td>
                <td className={`Numeric Strong ${f.tone(row.returnPct)}`}>{f.signedPercent(row.returnPct)}</td>
                <td className={`Numeric ${row.variant === 'current' ? '' : f.tone(row.deltaPct)}`}>
                  {row.variant === 'current' ? '—' : t('trading.fsFilterPoints', { value: f.signed(row.deltaPct, 1) })}
                </td>
                <td className="Numeric Negative">{f.signedPercent(row.maxDrawdownPct)}</td>
                <td className="Numeric">{f.number(row.profitFactor, 2)}</td>
                <td className={`Numeric ${f.tone(row.outReturnPct)}`}>{f.signedPercent(row.outReturnPct)}</td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
      <p className="Factsheet_Work_Verdict">
        {table.breakEvenFeeMult == null
          ? t('trading.fsCostBreakevenNone')
          : t('trading.fsCostBreakeven', {
              mult: f.number(table.breakEvenFeeMult, 2),
              fee: f.percent(table.feeEntryPct * table.breakEvenFeeMult, 3),
            })}
      </p>
    </Factsheet_Panel>
  );
};

interface Regimes_Props {
  table: Regime_Table;
  grid: Regime_Grid;
  unit: string;
}

// 3.6 — Por regime de tendência e de volatilidade, e o cruzamento dos dois
export const Factsheet_Regimes = ({ table, grid, unit }: Regimes_Props) => {
  const { t } = useTranslation();
  const { f } = useVerdictFormat([], unit);
  const line = (row: Regime_Row) => (
    <tr key={row.regime}>
      <td className="Strong">{t(`trading.fsRegime_${row.regime}`)}</td>
      <td className="Numeric">
        {f.number(row.days)} ({f.percent(row.daysPct, 0)})
      </td>
      <td className={`Numeric Strong ${f.tone(row.returnPct)}`}>{f.signedPercent(row.returnPct)}</td>
      <td className={`Numeric ${f.tone(row.annualPct)}`}>{f.signedPercent(row.annualPct)}</td>
      <td className={`Numeric ${f.tone(row.buyHoldAnnualPct)}`}>{f.signedPercent(row.buyHoldAnnualPct)}</td>
      <td className="Numeric">{f.number(row.trades)}</td>
      <td className="Numeric">{f.percent(row.winRatePct, 0)}</td>
      <td className={`Numeric ${f.tone(row.pnl)}`}>{row.trades ? f.money(row.pnl) : '—'}</td>
      <td className={`Numeric ${f.tone(row.expectancy)}`}>{f.money(row.expectancy, 2)}</td>
    </tr>
  );
  const head = (label: string) => (
    <tr>
      <th>{label}</th>
      <th className="Numeric">{t('trading.fsRegimeCol_days')}</th>
      <th className="Numeric">{t('trading.fsRegimeCol_return')}</th>
      <th className="Numeric">{t('trading.fsRegimeCol_annual')}</th>
      <th className="Numeric">{t('trading.fsRegimeCol_buyHold')}</th>
      <th className="Numeric">{t('trading.fsHourCol_trades')}</th>
      <th className="Numeric">{t('trading.fsHourCol_winRate')}</th>
      <th className="Numeric">{t('trading.fsRegimeCol_pnl')}</th>
      <th className="Numeric">{t('trading.fsHourCol_expectancy')}</th>
    </tr>
  );
  const largest = Math.max(1, ...grid.cells.flat().map((cell) => Math.abs(cell.annualPct ?? 0)));
  return (
    <>
      <Factsheet_Panel
        title={t('trading.fsRegimeTitle')}
        explain="proofRegimeTable"
        note={t('trading.fsRegimeNote', { trend: table.trendDays, slope: table.slopeDays, vol: table.volDays, median: f.percent(table.volMedianPct, 0) })}
      >
        <div className="Factsheet_Table_Scroll">
          <table className="Factsheet_Table">
            <thead>{head(t('trading.fsRegimeCol_trend'))}</thead>
            <tbody>{table.trend.map(line)}</tbody>
            <thead>{head(t('trading.fsRegimeCol_volatility'))}</thead>
            <tbody>{table.volatility.map(line)}</tbody>
          </table>
        </div>
      </Factsheet_Panel>
      <Factsheet_Panel title={t('trading.fsRegimeGridTitle')} explain="proofRegimeGrid" note={t('trading.fsRegimeGridNote')}>
        <div className="Factsheet_Table_Scroll">
          <table className="Factsheet_Table Factsheet_Entry_Blocks">
            <thead>
              <tr>
                <th>{t('trading.fsRegimeCol_trend')}</th>
                {grid.columns.map((column) => (
                  <th key={column} className="Centered">
                    {t(`trading.fsRegime_${column}`)}
                  </th>
                ))}
              </tr>
            </thead>
            <tbody>
              {grid.rows.map((rowKey, y) => (
                <tr key={rowKey}>
                  <td className="Strong">{t(`trading.fsRegime_${rowKey}`)}</td>
                  {grid.cells[y].map((cell, x) =>
                    cell.days ? (
                      <td key={x} className="Factsheet_Entry_Block" style={{ backgroundColor: tintOf(cell.annualPct, largest) }}>
                        <strong>{f.signedPercent(cell.annualPct ?? cell.returnPct)}</strong>
                        <span>{t('trading.fsRegimeCell', { days: f.number(cell.days), trades: f.number(cell.trades) })}</span>
                      </td>
                    ) : (
                      <td key={x} className="Factsheet_Entry_Block Empty">
                        —
                      </td>
                    ),
                  )}
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </Factsheet_Panel>
    </>
  );
};

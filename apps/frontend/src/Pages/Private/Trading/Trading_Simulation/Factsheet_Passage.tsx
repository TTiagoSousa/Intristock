import { useTranslation } from 'react-i18next';
import type { Passage_Groups, Session_Rules } from '../../../../Hooks/Trading/useSimulation';
import Factsheet_Panel from './Factsheet_Panel';
import { useFactsheetFormat } from './factsheetFormat';

interface Factsheet_Passage_Props {
  groups: Passage_Groups;
  rules: Session_Rules;
  unit: string;
}

/**
 * 5.9 — Trades por tipo de passagem (em UTC): os que fecham no mesmo dia, os
 * que atravessam a vela diária e os que atravessam o fim de semana (os três
 * separados), compras, vendas e todos, com os stops e os que saíram com gap; e
 * por baixo as regras de sessão corridas no motor, com o Δ contra a atual e o
 * retorno fora da amostra. Tudo vem calculado.
 */
const Factsheet_Passage = ({ groups, rules, unit }: Factsheet_Passage_Props) => {
  const { t } = useTranslation();
  const f = useFactsheetFormat(unit);
  const points = (value: number | null) => (value == null ? '—' : t('trading.fsFilterPoints', { value: f.signed(value, 1) }));

  return (
    <Factsheet_Panel title={t('trading.fsPassageTitle')} explain="hoursPassage" note={t('trading.fsPassageNote')}>
      <div className="Factsheet_Table_Scroll">
        <table className="Factsheet_Table">
          <thead>
            <tr>
              <th>{t('trading.fsPassageCol_group')}</th>
              <th className="Numeric">{t('trading.fsHourCol_trades')}</th>
              <th className="Numeric">{t('trading.fsHourCol_pnl')}</th>
              <th className="Numeric">{t('trading.fsHourCol_stops')}</th>
              <th className="Numeric">{t('trading.fsPassageCol_gapStops')}</th>
            </tr>
          </thead>
          <tbody>
            {groups.rows.map((row) => (
              <tr key={row.group} className={row.group === 'all' ? 'Total' : ''}>
                <td>{t(`trading.fsPassage_${row.group}`)}</td>
                <td className="Numeric">{f.number(row.trades)}</td>
                <td className={`Numeric Strong ${f.tone(row.pnl)}`}>{row.trades ? f.money(row.pnl) : '—'}</td>
                <td className="Numeric">
                  {row.trades ? `${f.number(row.stops)} (${f.percent(row.stopsPct, 0)})` : '—'}
                </td>
                <td className={`Numeric ${row.gapStops ? 'Negative' : ''}`}>{f.number(row.gapStops)}</td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
      <div className="Factsheet_Table_Scroll">
        <table className="Factsheet_Table">
          <thead>
            <tr>
              <th>{t('trading.fsRulesCol_rule')}</th>
              <th className="Numeric">{t('trading.fsHourCol_trades')}</th>
              <th className="Numeric">{t('trading.fsFiltersCol_return')}</th>
              <th className="Numeric">{t('trading.fsFiltersCol_delta')}</th>
              <th className="Numeric">{t('trading.fsFiltersCol_maxDd')}</th>
              <th className="Numeric">{t('trading.fsFiltersCol_outside')}</th>
              <th className="Numeric">{t('trading.fsFiltersCol_deltaOut')}</th>
            </tr>
          </thead>
          <tbody>
            {rules.rows.map((row) => {
              const current = row.rule === 'current';
              return (
                <tr key={row.rule}>
                  <td className={current ? 'Strong' : ''}>{t(`trading.fsRule_${row.rule}`)}</td>
                  <td className="Numeric">{f.number(row.trades)}</td>
                  <td className={`Numeric Strong ${f.tone(row.returnPct)}`}>{f.signedPercent(row.returnPct)}</td>
                  <td className={`Numeric ${current ? '' : f.tone(row.deltaPct)}`}>{current ? '—' : points(row.deltaPct)}</td>
                  <td className="Numeric Negative">{f.signedPercent(row.maxDrawdownPct)}</td>
                  <td className={`Numeric ${f.tone(row.outReturnPct)}`}>{f.signedPercent(row.outReturnPct)}</td>
                  <td className={`Numeric ${current ? '' : f.tone(row.deltaOutPct)}`}>{current ? '—' : points(row.deltaOutPct)}</td>
                </tr>
              );
            })}
          </tbody>
        </table>
      </div>
    </Factsheet_Panel>
  );
};

export default Factsheet_Passage;

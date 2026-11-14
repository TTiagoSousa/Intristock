import { useTranslation } from 'react-i18next';
import type { Duration_By_Weekday } from '../../../../Hooks/Trading/useSimulation';
import Factsheet_Panel from './Factsheet_Panel';
import { useFactsheetFormat } from './factsheetFormat';

interface Factsheet_Duration_Weekday_Props {
  table: Duration_By_Weekday;
}

/**
 * 5.7 — Duração por dia da semana (pelo dia de entrada) e por tipo de saída:
 * as velas médias de todos os trades e até cada saída que aconteceu na
 * simulação. Tudo vem calculado.
 */
const Factsheet_Duration_Weekday = ({ table }: Factsheet_Duration_Weekday_Props) => {
  const { t } = useTranslation();
  const f = useFactsheetFormat('');

  return (
    <Factsheet_Panel title={t('trading.fsDurationDayTitle')} explain="hoursDurationDay" note={t('trading.fsDurationDayNote')}>
      <div className="Factsheet_Table_Scroll">
        <table className="Factsheet_Table">
          <thead>
            <tr>
              <th>{t('trading.fsWeekdayCol_day')}</th>
              <th className="Numeric">{t('trading.fsHourCol_trades')}</th>
              <th className="Numeric">{t('trading.fsDurationDayCol_avg')}</th>
              {table.reasons.map((reason) => (
                <th key={reason} className="Numeric">
                  {t(`trading.fsDurationDayCol_${reason}`)}
                </th>
              ))}
            </tr>
          </thead>
          <tbody>
            {table.rows.map((row) => (
              <tr key={row.day}>
                <td className="Strong">{t(`trading.fsWeekday_${row.day}`)}</td>
                <td className="Numeric">{f.number(row.trades)}</td>
                <td className="Numeric Strong">{f.number(row.avgBars, 1)}</td>
                {row.byExit.map((value, index) => (
                  <td key={table.reasons[index]} className="Numeric">
                    {f.number(value, 1)}
                  </td>
                ))}
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    </Factsheet_Panel>
  );
};

export default Factsheet_Duration_Weekday;

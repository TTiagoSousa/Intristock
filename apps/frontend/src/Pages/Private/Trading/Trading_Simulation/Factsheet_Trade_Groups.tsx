import { useTranslation } from 'react-i18next';
import type { Trade_Groups } from '../../../../Hooks/Trading/useSimulation';
import Factsheet_Panel from './Factsheet_Panel';
import { useFactsheetFormat } from './factsheetFormat';

interface Factsheet_Trade_Groups_Props {
  table: Trade_Groups;
  unit: string;
}

/**
 * 4.8 — Pirâmide, tipo de ordem e ordem no dia: a posição na pirâmide, a ordem
 * a mercado contra por nível (limite e stop) e o primeiro trade do dia contra
 * os seguintes. Só os grupos que têm trades; tudo vem calculado.
 */
const Factsheet_Trade_Groups = ({ table, unit }: Factsheet_Trade_Groups_Props) => {
  const { t } = useTranslation();
  const f = useFactsheetFormat(unit);

  return (
    <Factsheet_Panel title={t('trading.fsGroupsTitle')} explain="entryGroups" note={t('trading.fsGroupsNote')}>
      <div className="Factsheet_Table_Scroll">
        <table className="Factsheet_Table">
          <thead>
            <tr>
              <th>{t('trading.fsGroupsCol_group')}</th>
              <th className="Numeric">{t('trading.fsGroupsCol_trades')}</th>
              <th className="Numeric">{t('trading.fsGroupsCol_winRate')}</th>
              <th className="Numeric">{t('trading.fsGroupsCol_avgR')}</th>
              <th className="Numeric">{t('trading.fsGroupsCol_pnl')}</th>
              <th className="Numeric">{t('trading.fsGroupsCol_stops')}</th>
              <th className="Numeric">{t('trading.fsGroupsCol_bars')}</th>
            </tr>
          </thead>
          <tbody>
            {table.rows.map((row) => (
              <tr key={row.group}>
                <td className="Strong">{t(`trading.fsGroup_${row.group}`)}</td>
                <td className="Numeric">{f.number(row.trades)}</td>
                <td className="Numeric">{f.percent(row.winRatePct, 0)}</td>
                <td className={`Numeric Strong ${f.tone(row.avgR)}`}>{f.r(row.avgR)}</td>
                <td className={`Numeric ${f.tone(row.pnl)}`}>{f.money(row.pnl)}</td>
                <td className="Numeric">{f.percent(row.stopsPct, 0)}</td>
                <td className="Numeric">{f.number(row.avgBars, 1)}</td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    </Factsheet_Panel>
  );
};

export default Factsheet_Trade_Groups;

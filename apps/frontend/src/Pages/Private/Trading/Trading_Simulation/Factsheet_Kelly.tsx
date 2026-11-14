import { useTranslation } from 'react-i18next';
import type { Entry_Kelly, Entry_Payload } from '../../../../Hooks/Trading/useSimulation';
import Factsheet_Entry_Name from './Factsheet_Entry_Name';
import Factsheet_Panel from './Factsheet_Panel';
import { useFactsheetFormat } from './factsheetFormat';

interface Factsheet_Kelly_Props {
  table: Entry_Kelly;
  entries: Entry_Payload[];
}

/**
 * 4.6 — Kelly e tamanho sugerido por entrada, só com a parte dentro da amostra:
 * win rate, payoff, Kelly, ¼ Kelly, o proporcional à expectancy e a sugestão
 * (até ¼ Kelly, no máximo 1,5%; sem Kelly positivo, desligar ou rever).
 */
const Factsheet_Kelly = ({ table, entries }: Factsheet_Kelly_Props) => {
  const { t } = useTranslation();
  const f = useFactsheetFormat('');

  return (
    <Factsheet_Panel title={t('trading.fsKellyTitle')} explain="entryKelly" note={t('trading.fsKellyNote')}>
      <div className="Factsheet_Table_Scroll">
        <table className="Factsheet_Table">
          <thead>
            <tr>
              <th>{t('trading.fsKellyCol_entry')}</th>
              <th className="Numeric">{t('trading.fsKellyCol_winRate')}</th>
              <th className="Numeric">{t('trading.fsKellyCol_payoff')}</th>
              <th className="Numeric">{t('trading.fsKellyCol_kelly')}</th>
              <th className="Numeric">{t('trading.fsKellyCol_quarter')}</th>
              <th className="Numeric">{t('trading.fsKellyCol_proportional')}</th>
              <th className="Numeric">{t('trading.fsKellyCol_suggestion')}</th>
            </tr>
          </thead>
          <tbody>
            {table.rows.map((row) => (
              <tr key={row.rule}>
                <td>
                  <Factsheet_Entry_Name entries={entries} rule={row.rule} />
                </td>
                <td className="Numeric">{f.percent(row.winRatePct)}</td>
                <td className="Numeric">{f.number(row.payoff, 2)}</td>
                <td className="Numeric">{f.percent(row.kellyPct)}</td>
                <td className="Numeric">{f.percent(row.quarterKellyPct, 2)}</td>
                <td className="Numeric">{f.percent(row.proportionalPct, 2)}</td>
                <td className={`Numeric ${row.suggestionPct == null ? 'Negative' : 'Positive'}`}>
                  {row.suggestionPct == null
                    ? t('trading.fsKellyOff')
                    : t('trading.fsKellyUpTo', { value: f.number(row.suggestionPct, 1) })}
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    </Factsheet_Panel>
  );
};

export default Factsheet_Kelly;

import { useTranslation } from 'react-i18next';
import type { After_Exit } from '../../../../Hooks/Trading/useSimulation';
import Factsheet_Panel from './Factsheet_Panel';
import { useFactsheetFormat } from './factsheetFormat';

// A explicação do "?" de cada tabela (uma por tipo de saída)
const AFTER_EXPLAIN: Record<After_Exit['tables'][number]['kind'], string> = {
  take_profit: 'entryAfterTake',
  stop_loss: 'entryAfterStop',
  trailing_stop: 'entryAfterTrailing',
};

interface Factsheet_After_Exit_Props {
  data: After_Exit;
}

/**
 * 4.4 — Depois da saída: o que o preço fez N velas depois do take, do stop e do
 * trailing. O movimento é a favor do trade; no take e no trailing, quantos
 * continuaram +2% e quantos voltaram à entrada; no stop, quantos chegaram ao
 * take original (o stop prematuro).
 */
const Factsheet_After_Exit = ({ data }: Factsheet_After_Exit_Props) => {
  const { t } = useTranslation();
  const f = useFactsheetFormat('');
  const continued = f.number(data.continuedPct, 0);

  return (
    <div className="Factsheet_Grid Three">
      {data.tables.map((table) => {
        const stop = table.kind === 'stop_loss';
        return (
          <Factsheet_Panel
            key={table.kind}
            title={t(`trading.fsAfterTitle_${table.kind}`)}
            note={t(`trading.fsAfterNote_${table.kind}`)}
            explain={AFTER_EXPLAIN[table.kind]}
          >
            {table.trades ? (
              <div className="Factsheet_Table_Scroll">
                <table className="Factsheet_Table Compact">
                  <thead>
                    <tr>
                      <th>{t('trading.fsAfterCol_horizon')}</th>
                      <th className="Numeric">{t('trading.fsAfterCol_move')}</th>
                      {stop ? (
                        <th className="Numeric">{t('trading.fsAfterCol_reachedTake')}</th>
                      ) : (
                        <>
                          <th className="Numeric">{t('trading.fsAfterCol_continued', { pct: continued })}</th>
                          <th className="Numeric">{t('trading.fsAfterCol_returned')}</th>
                        </>
                      )}
                    </tr>
                  </thead>
                  <tbody>
                    {table.rows.map((row) => (
                      <tr key={row.bars}>
                        <td>{t('trading.fsAfterBars', { count: row.bars })}</td>
                        <td className={`Numeric ${f.tone(row.avgMovePct)}`}>{f.signedPercent(row.avgMovePct, 2)}</td>
                        {stop ? (
                          <td className="Numeric">{f.percent(row.reachedTakePct, 0)}</td>
                        ) : (
                          <>
                            <td className="Numeric">{f.percent(row.continuedPct, 0)}</td>
                            <td className="Numeric">{f.percent(row.returnedPct, 0)}</td>
                          </>
                        )}
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            ) : (
              <span className="Factsheet_Hint">{t(`trading.fsAfterNone_${table.kind}`)}</span>
            )}
          </Factsheet_Panel>
        );
      })}
    </div>
  );
};

export default Factsheet_After_Exit;

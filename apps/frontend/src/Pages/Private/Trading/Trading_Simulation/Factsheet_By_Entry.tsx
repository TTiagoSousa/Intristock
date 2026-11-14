import { useTranslation } from 'react-i18next';
import type { Entry_Breakdown, Simulation_Run } from '../../../../Hooks/Trading/useSimulation';
import { formatNumber } from '../Trading_Simulator/format';
import { entryLabel } from '../Trading_Simulator/labels';
import { entriesOf } from '../Trading_Simulator/simulationForm';
import Factsheet_Explain from './Factsheet_Explain';

interface Factsheet_By_Entry_Props {
  table: Entry_Breakdown;
  run: Simulation_Run;
}

// As cores das entradas (o quadrado ao lado do nome), pela ordem da lista
const ENTRY_COLORS = 6;

// As moedas que se mostram como $
const DOLLAR_QUOTES = ['USDT', 'USDC', 'USD'];

/**
 * 2.2 — Por entrada: os sinais, os trades, a % de sinais que deram trade, o win
 * rate, o P&L líquido e a expectancy em R de cada entrada. Tudo vem calculado; os
 * nomes saem da estratégia gravada.
 */
const Factsheet_By_Entry = ({ table, run }: Factsheet_By_Entry_Props) => {
  const { t, i18n } = useTranslation();
  const language = i18n.language;
  const entries = entriesOf(run.strategy);
  const unit = DOLLAR_QUOTES.includes(run.instrument.quote) ? '$' : run.instrument.quote;

  const number = (value: number) => formatNumber(value, language, 0);
  const percent = (value: number | null, digits: number) => (value == null ? '—' : `${formatNumber(value, language, digits)}%`);
  const signed = (value: number, digits: number) =>
    `${value > 0 ? '+' : value < 0 ? '−' : ''}${formatNumber(Math.abs(value), language, digits)}`;
  const tone = (value: number | null) => (value == null ? '' : value > 0 ? 'Positive' : value < 0 ? 'Negative' : '');

  return (
    <div className="Factsheet_Panel">
      <div className="Factsheet_Panel_Header">
        <div className="Factsheet_Panel_Heading">
          <span className="Factsheet_Panel_Title">
            {t('trading.fsByEntryTitle')}
            <Factsheet_Explain id="setupByEntry" title={t('trading.fsByEntryTitle')} />
          </span>
          <span className="Factsheet_Panel_Note">{t('trading.fsByEntryNote')}</span>
        </div>
      </div>
      <div className="Factsheet_Table_Scroll">
        <table className="Factsheet_Table Factsheet_By_Entry">
          <thead>
            <tr>
              <th>{t('trading.fsByEntryEntry')}</th>
              <th className="Numeric">{t('trading.fsByEntrySignals')}</th>
              <th className="Numeric">{t('trading.fsByEntryTrades')}</th>
              <th className="Numeric">{t('trading.fsByEntryExecuted')}</th>
              <th className="Numeric">{t('trading.fsByEntryWinRate')}</th>
              <th className="Numeric">{t('trading.fsByEntryPnl')}</th>
              <th className="Numeric">{t('trading.fsByEntryExpectancy')}</th>
            </tr>
          </thead>
          <tbody>
            {table.entries.map((row) => (
              <tr key={row.rule}>
                <td>
                  <span className="Factsheet_By_Entry_Name">
                    <span className={`Factsheet_By_Entry_Dot Color_${((row.rule - 1) % ENTRY_COLORS) + 1}`} />
                    {entryLabel(entries, row.rule, t)}
                  </span>
                </td>
                <td className="Numeric">{number(row.signals)}</td>
                <td className="Numeric">{number(row.trades)}</td>
                <td className="Numeric">{percent(row.executedPct, 0)}</td>
                <td className="Numeric">{percent(row.winRatePct, 1)}</td>
                <td className={`Numeric ${tone(row.pnl)}`}>{`${signed(row.pnl, 0)} ${unit}`}</td>
                <td className={`Numeric ${tone(row.expectancyR)}`}>
                  {row.expectancyR == null ? '—' : `${signed(row.expectancyR, 2)}R`}
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
      <p className="Factsheet_By_Entry_Footnote">{t('trading.fsByEntryFootnote')}</p>
    </div>
  );
};

export default Factsheet_By_Entry;

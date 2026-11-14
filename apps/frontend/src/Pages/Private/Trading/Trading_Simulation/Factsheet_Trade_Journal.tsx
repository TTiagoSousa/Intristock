import { useState } from 'react';
import { useTranslation } from 'react-i18next';
import Global_Pagination from '../../../../Components/Pagination/Global_Pagination/Global_Pagination';
import { useSimulationTrades } from '../../../../Hooks/Trading/useSimulation';
import type { Entry_Payload, Simulation_Run, Simulation_Trade } from '../../../../Hooks/Trading/useSimulation';
import { formatDateTime, formatNumber, formatPrice } from '../Trading_Simulator/format';
import { exitColumnLabel } from '../Trading_Simulator/labels';
import { entriesOf } from '../Trading_Simulator/simulationForm';
import Factsheet_Entry_Name from './Factsheet_Entry_Name';
import Factsheet_Panel from './Factsheet_Panel';
import { exitColorClass, moneyUnit, useFactsheetFormat } from './factsheetFormat';

interface Factsheet_Trade_Journal_Props {
  run: Simulation_Run;
}

// Quantos trades por página (no painel, os últimos; em ecrã inteiro, todos às páginas)
const PAGE_SIZE = 20;

// Os motivos que um ajuste do stop pode dar
const ADJUSTED_REASONS: string[] = ['stop_loss', 'trailing_stop', 'break_even'];

// A saída de um trade como as colunas da 4.2: o motivo e o valor da entrada
// (stop 2%, alvo 5%, 36 velas…) ou a condição de saída
const exitOf = (entries: Entry_Payload[], trade: Simulation_Trade) => {
  const entry = entries[trade.entryRule - 1];
  // O stop na mínima/máxima ou num nível e o take em R não têm uma % fixa
  const value = {
    stop_loss: (entry?.stopLossMode ?? 'pct') === 'pct' ? entry?.stopLossPct : null,
    take_profit: entry?.takeProfitR ? null : entry?.takeProfitPct,
    trailing_stop: entry?.trailingStopPct,
    break_even: entry?.breakEvenPct,
    time: entry?.maxBars,
  }[trade.exitReason as string];
  // Num stop, o exitRule é o ajuste (stopRules) que o pôs lá
  const adjusted = ADJUSTED_REASONS.includes(trade.exitReason) && trade.exitRule ? trade.exitRule : null;
  return {
    reason: trade.exitReason as string,
    value: adjusted ? null : (value ?? null),
    rule: trade.exitReason === 'signal' || adjusted ? trade.entryRule : null,
    exit: trade.exitReason === 'signal' ? trade.exitRule : null,
    adjust: adjusted,
    rules: [trade.entryRule],
  };
};

/**
 * 4.7 — Diário de trades: os últimos 20 trades, do mais recente, com os campos
 * da lista do simulador e ainda as velas, a MAE e a MFE (gravadas com cada
 * trade). "Ver todos" abre o painel em ecrã inteiro com a lista toda, às
 * páginas; cada página é um pedido ao servidor.
 */
const Factsheet_Trade_Journal = ({ run }: Factsheet_Trade_Journal_Props) => {
  const { t } = useTranslation();
  const [fullscreen, setFullscreen] = useState(false);
  const [page, setPage] = useState(1);
  const entries = entriesOf(run.strategy);
  const unit = moneyUnit(run.instrument.quote);
  const f = useFactsheetFormat(unit);
  const { trades, total, loading } = useSimulationTrades(
    run.id,
    fullscreen ? page : 1,
    {},
    { pageSize: PAGE_SIZE, order: 'desc' },
  );
  const totalPages = Math.max(1, Math.ceil(total / PAGE_SIZE));

  const changeFullscreen = (value: boolean) => {
    setFullscreen(value);
    setPage(1);
  };

  return (
    <Factsheet_Panel
      title={fullscreen ? t('trading.fsJournalAllTitle', { count: total }) : t('trading.fsJournalTitle', { count: PAGE_SIZE })}
      note={t('trading.fsJournalNote')}
      explain="entryJournal"
      fullscreen={fullscreen}
      onFullscreenChange={changeFullscreen}
      actions={
        !fullscreen &&
        total > PAGE_SIZE && (
          <button type="button" className="Factsheet_Panel_Button" onClick={() => changeFullscreen(true)}>
            {t('trading.fsJournalSeeAll', { count: total })}
          </button>
        )
      }
    >
      {!loading && trades.length === 0 ? (
        <span className="Factsheet_Hint">{t('trading.fsJournalNone')}</span>
      ) : (
        <div className="Factsheet_Table_Scroll">
          <table className="Factsheet_Table Factsheet_Journal">
            <thead>
              <tr>
                <th className="Numeric">#</th>
                <th>{t('trading.fsJournalCol_entry')}</th>
                <th>{t('trading.fsJournalCol_side')}</th>
                <th>{t('trading.fsJournalCol_entryTime')}</th>
                <th className="Numeric">{t('trading.fsJournalCol_price')}</th>
                <th>{t('trading.fsJournalCol_exitTime')}</th>
                <th>{t('trading.fsJournalCol_reason')}</th>
                <th className="Numeric">{t('trading.fsJournalCol_price')}</th>
                <th className="Numeric">{t('trading.fsJournalCol_quantity')}</th>
                <th className="Numeric">{t('trading.fsJournalCol_bars')}</th>
                <th className="Numeric">MAE</th>
                <th className="Numeric">MFE</th>
                <th className="Numeric">{t('trading.fsJournalCol_fees')}</th>
                <th className="Numeric">{t('trading.fsJournalCol_funding')}</th>
                <th className="Numeric">{t('trading.fsJournalCol_result')}</th>
                <th className="Numeric">%</th>
                <th className="Numeric">{t('trading.fsJournalCol_equity')}</th>
              </tr>
            </thead>
            <tbody>
              {loading ? (
                <tr>
                  <td colSpan={17} className="Factsheet_Journal_Message">
                    {t('common.loading')}
                  </td>
                </tr>
              ) : (
                trades.map((trade) => {
                  const exit = exitOf(entries, trade);
                  // O funding guarda-se pago; aqui, como no P&L, recebido é positivo
                  const funding = -(trade.funding ?? 0);
                  return (
                    <tr key={trade.index}>
                      <td className="Numeric">{trade.index}</td>
                      <td>
                        <Factsheet_Entry_Name entries={entries} rule={trade.entryRule} />
                      </td>
                      <td className={trade.side === 'long' ? 'Positive' : 'Negative'}>
                        {t(`trading.fsEntSide_${trade.side}`)}
                      </td>
                      <td className="Numeric Left">{formatDateTime(trade.entryTime, f.language)}</td>
                      <td className="Numeric">{formatPrice(trade.entryPrice, f.language)}</td>
                      <td className="Numeric Left">{formatDateTime(trade.exitTime, f.language)}</td>
                      <td>
                        <span className="Factsheet_By_Entry_Name">
                          <span className={`Factsheet_Legend_Square ${exitColorClass(exit.reason)}`} />
                          {exitColumnLabel(entries, exit, t, f.language)}
                        </span>
                        {trade.adds?.map((add, index) => (
                          <span key={`add-${index}`} className="Factsheet_Journal_Partial">
                            {t('trading.fsJournalAdd', {
                              quantity: formatNumber(add.quantity, f.language, 4),
                              price: formatPrice(add.price, f.language),
                            })}
                          </span>
                        ))}
                        {trade.partials?.map((part, index) => (
                          <span key={index} className="Factsheet_Journal_Partial">
                            {t('trading.fsJournalPartial', {
                              quantity: formatNumber(part.quantity, f.language, 4),
                              price: formatPrice(part.price, f.language),
                            })}
                          </span>
                        ))}
                      </td>
                      <td className="Numeric">{formatPrice(trade.exitPrice, f.language)}</td>
                      <td className="Numeric">{formatNumber(trade.quantity, f.language, 4)}</td>
                      <td className="Numeric">{f.number(trade.bars)}</td>
                      <td className="Numeric">{f.percent(trade.maePct, 2)}</td>
                      <td className="Numeric">{f.percent(trade.mfePct, 2)}</td>
                      <td className="Numeric">{`${f.number(trade.fees, 2)} ${unit}`}</td>
                      <td className={`Numeric ${f.tone(funding)}`}>{f.money(funding, 2)}</td>
                      <td className={`Numeric Strong ${f.tone(trade.pnl)}`}>{f.money(trade.pnl, 2)}</td>
                      <td className={`Numeric ${f.tone(trade.pnlPct)}`}>{f.signedPercent(trade.pnlPct)}</td>
                      <td className="Numeric">{f.number(trade.equity)}</td>
                    </tr>
                  );
                })
              )}
            </tbody>
          </table>
        </div>
      )}
      {fullscreen && (
        <Global_Pagination
          page={page}
          totalPages={totalPages}
          onPageChange={setPage}
          totalItems={total}
          pageSize={PAGE_SIZE}
        />
      )}
    </Factsheet_Panel>
  );
};

export default Factsheet_Trade_Journal;

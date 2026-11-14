import { useTranslation } from 'react-i18next';
import type { Live_Test, Live_Tick } from '../../../../Hooks/Trading/useLiveTests';
import type { Simulation_Run } from '../../../../Hooks/Trading/useSimulation';
import { chartExitKeyOf, exitLabel } from '../Trading_Simulator/labels';
import Factsheet_Card from './Factsheet_Card';
import Factsheet_Panel from './Factsheet_Panel';
import { moneyUnit, useFactsheetFormat } from './factsheetFormat';
import type { useLiveTexts } from './liveTexts';

interface Live_Info_Props {
  run: Simulation_Run;
  test: Live_Test;
  tick: Live_Tick | null;
  texts: ReturnType<typeof useLiveTexts>;
}

// Os últimos trades fechados que se veem na tabela (o gráfico tem todos)
const RECENT_TRADES = 10;

/**
 * Por baixo do gráfico: os números do teste (o preço, a equity, o capital, o P&L
 * realizado e o flutuante, os trades), as posições abertas com o P&L ao preço de
 * agora e os últimos trades fechados. Tudo do simulador; o preço e o P&L das
 * posições mexem a cada negócio.
 */
const Live_Info = ({ run, test, tick, texts }: Live_Info_Props) => {
  const { t } = useTranslation();
  const f = useFactsheetFormat(moneyUnit(run.instrument.quote));
  const state = test.state;
  if (!state) return null;

  const entries = run.strategy.entries ?? [];
  const price = tick?.price ?? state.price;
  const equity = tick?.equity ?? state.equity;
  const unrealized = tick?.unrealized ?? state.unrealized;
  const livePnl = new Map((tick?.positions ?? []).map((item) => [item.key, item.pnl]));
  const total = equity - state.initialCapital - state.deposited;
  const base = state.initialCapital + state.deposited;
  const wins = state.trades.filter((trade) => trade.pnl > 0).length;
  const recent = [...state.trades].reverse().slice(0, RECENT_TRADES);

  return (
    <>
      <div className="Factsheet_Cards Live_Cards">
        <Factsheet_Card
          label={t('trading.liveCard_price')}
          help={t('trading.liveCardHelp_price')}
          value={texts.price(price)}
          detail={state.waitingFirstBar ? t('trading.liveWaitingFirstBar') : texts.moment(state.priceTime)}
        />
        <Factsheet_Card
          label={t('trading.liveCard_equity')}
          help={t('trading.liveCardHelp_equity')}
          value={f.number(equity, 2)}
          detail={t('trading.liveCard_equityDetail', { pct: f.signedPercent(base ? (total / base) * 100 : null, 2) })}
          tone={f.tone(total)}
        />
        <Factsheet_Card
          label={t('trading.liveCard_realized')}
          help={t('trading.liveCardHelp_realized')}
          value={f.money(state.realized, 2)}
          detail={t('trading.liveCard_capital', { capital: f.number(state.capital, 2) })}
          tone={f.tone(state.realized)}
        />
        <Factsheet_Card
          label={t('trading.liveCard_unrealized')}
          help={t('trading.liveCardHelp_unrealized')}
          value={f.money(unrealized, 2)}
          detail={t('trading.liveCard_open', { count: state.open.length })}
          tone={f.tone(unrealized)}
        />
        <Factsheet_Card
          label={t('trading.liveCard_trades')}
          help={t('trading.liveCardHelp_trades')}
          value={f.number(state.trades.length)}
          detail={t('trading.liveCard_tradesDetail', {
            rate: state.trades.length ? f.percent((wins / state.trades.length) * 100, 0) : '—',
          })}
        />
        <Factsheet_Card
          label={t('trading.liveCard_deposits')}
          help={t('trading.liveCardHelp_deposits')}
          value={f.number(state.deposited, 2)}
          detail={
            state.pausedUntil > state.priceTime
              ? t('trading.liveCard_paused', { until: texts.moment(state.pausedUntil) })
              : state.pending.length
                ? t('trading.liveCard_pending', { entries: state.pending.map((rule) => texts.entryName(rule)).join(', ') })
                : t('trading.liveCard_noPending')
          }
        />
      </div>

      <div className="Live_Tables">
        <Factsheet_Panel title={t('trading.liveOpenTitle')} note={t('trading.liveOpenNote')}>
          {state.open.length ? (
            <div className="Factsheet_Table_Scroll">
              <table className="Factsheet_Table">
                <thead>
                  <tr>
                    <th>{t('trading.liveCol_entry')}</th>
                    <th>{t('trading.liveCol_opened')}</th>
                    <th className="Numeric">{t('trading.liveCol_price')}</th>
                    <th className="Numeric">{t('trading.liveCol_quantity')}</th>
                    <th className="Numeric">{t('trading.liveCol_stop')}</th>
                    <th className="Numeric">{t('trading.liveCol_take')}</th>
                    <th className="Numeric">{t('trading.liveCol_pnl')}</th>
                  </tr>
                </thead>
                <tbody>
                  {state.open.map((position) => {
                    const pnl = livePnl.get(position.key) ?? position.pnl;
                    return (
                      <tr key={position.key}>
                        <td>
                          {texts.entryName(position.entry)} · {texts.side(position.side)}
                        </td>
                        <td>{texts.moment(position.entryTime)}</td>
                        <td className="Numeric">{texts.price(position.average)}</td>
                        <td className="Numeric">{texts.quantity(position.quantity)}</td>
                        <td className="Numeric">{position.stop == null ? '—' : texts.price(position.stop)}</td>
                        <td className="Numeric">{position.take == null ? '—' : texts.price(position.take)}</td>
                        <td className={`Numeric Strong ${f.tone(pnl)}`}>{f.money(pnl, 2)}</td>
                      </tr>
                    );
                  })}
                </tbody>
              </table>
            </div>
          ) : (
            <span className="Factsheet_Hint">{t('trading.liveNoOpen')}</span>
          )}
        </Factsheet_Panel>

        <Factsheet_Panel title={t('trading.liveTradesTitle')} note={t('trading.liveTradesNote', { count: RECENT_TRADES })}>
          {recent.length ? (
            <div className="Factsheet_Table_Scroll">
              <table className="Factsheet_Table">
                <thead>
                  <tr>
                    <th>{t('trading.liveCol_entry')}</th>
                    <th>{t('trading.liveCol_closed')}</th>
                    <th>{t('trading.liveCol_exit')}</th>
                    <th className="Numeric">{t('trading.liveCol_price')}</th>
                    <th className="Numeric">{t('trading.liveCol_pnl')}</th>
                  </tr>
                </thead>
                <tbody>
                  {recent.map((trade) => (
                    <tr key={trade.key}>
                      <td>
                        {texts.entryName(trade.entryRule)} · {texts.side(trade.side)}
                      </td>
                      <td>{texts.moment(trade.exitTime)}</td>
                      <td>{exitLabel(entries, trade.entryRule, chartExitKeyOf(trade), t)}</td>
                      <td className="Numeric">{texts.price(trade.exitPrice)}</td>
                      <td className={`Numeric Strong ${f.tone(trade.pnl)}`}>{f.money(trade.pnl, 2)}</td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          ) : (
            <span className="Factsheet_Hint">{t('trading.liveNoTrades')}</span>
          )}
        </Factsheet_Panel>
      </div>
    </>
  );
};

export default Live_Info;

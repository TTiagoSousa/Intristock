import { useNavigate } from 'react-router-dom';
import { useTranslation } from 'react-i18next';
import { useActiveLiveTests } from '../../../../Hooks/Trading/useLiveTests';
import type { Live_Test } from '../../../../Hooks/Trading/useLiveTests';
import { formatNumber, formatPct, formatPrice, toneOf } from '../Trading_Simulator/format';
import '../Trading_Simulations/Trading_Simulations.scss';
import '../Trading_Simulation/Run_Live.scss';

/**
 * Os testes ao vivo que estão a decorrer (à espera do início, a correr ou a
 * parar), de todas as simulações. Cada linha abre a página da simulação no
 * separador «Teste ao vivo», com esse teste escolhido. A lista vê-se outra vez
 * de 15 em 15 s.
 */
const Trading_Live = () => {
  const { t, i18n } = useTranslation();
  const navigate = useNavigate();
  const { tests } = useActiveLiveTests();
  const language = i18n.language;

  const marketOf = (test: Live_Test) => `${test.instrument.asset.ticker ?? test.instrument.symbol}/${test.instrument.quote}`;
  const moment = (value: string) =>
    new Date(value).toLocaleString(language, { day: '2-digit', month: '2-digit', hour: '2-digit', minute: '2-digit' });

  return (
    <div className="Trading_Simulations">
      <div className="Page_Card">
        <div className="Card_Header">
          <div className="Card_Header_Text">
            <span className="Card_Title">{t('trading.liveRunsTitle')}</span>
            <span className="Card_Subtitle">
              {tests === null ? ' ' : t('trading.liveRunsCount', { count: tests.length })}
            </span>
          </div>
        </div>

        {tests === null ? (
          <span className="Empty_Message">{t('common.loading')}</span>
        ) : tests.length === 0 ? (
          <span className="Empty_Message">{t('trading.liveRunsEmpty')}</span>
        ) : (
          <div className="Trades_Table_Scroll">
            <table className="Trades_Table">
              <thead>
                <tr>
                  <th>{t('trading.runsColumnMarket')}</th>
                  <th>{t('trading.runsColumnStatus')}</th>
                  <th>{t('trading.liveRunsColumnPeriod')}</th>
                  <th className="Right">{t('trading.liveRunsColumnCapital')}</th>
                  <th className="Right">{t('trading.liveCard_equity')}</th>
                  <th className="Right">{t('trading.liveRunsColumnReturn')}</th>
                  <th className="Right">{t('trading.runsColumnTrades')}</th>
                  <th className="Right">{t('trading.runsColumnWinRate')}</th>
                  <th className="Right">{t('trading.liveRunsColumnOpen')}</th>
                  <th className="Right">{t('trading.liveCard_price')}</th>
                </tr>
              </thead>

              <tbody>
                {tests.map((test) => {
                  const summary = test.summary ?? null;
                  const capital = summary?.initialCapital ?? Number(test.strategy.initialCapital);
                  // O retorno sem os depósitos, como no cartão da equity do teste
                  const base = summary ? summary.initialCapital + summary.deposited : 0;
                  const returnPct = summary && base ? ((summary.equity - base) / base) * 100 : null;
                  return (
                    <tr
                      key={test.id}
                      className="Simulation_Row"
                      onClick={() => navigate(`/Trading/simulacoes/${test.runId}?view=live&test=${test.id}`)}
                    >
                      <td>
                        <span className="Simulation_Market">{marketOf(test)}</span>
                        <span className="Simulation_Market_Detail">
                          {t(`trading.type_${test.instrument.type}`)} · {t(`trading.tf_${test.timeframe}`)}
                        </span>
                      </td>
                      <td>
                        <span className={`Live_Status ${test.status}`}>
                          <span className="Live_Status_Dot" aria-hidden="true" />
                          {t(`trading.liveStatus_${test.status}`)}
                        </span>
                      </td>
                      <td className="Numeric Left">
                        {moment(test.startAt)} → {test.endAt ? moment(test.endAt) : t('trading.liveNoEnd')}
                      </td>
                      <td className="Amount">{formatNumber(capital, language)}</td>
                      <td className="Amount">{summary ? formatNumber(summary.equity, language) : '—'}</td>
                      <td className={`Amount Simulation_Result ${toneOf(returnPct)}`}>{formatPct(returnPct, language)}</td>
                      <td className="Amount">{summary ? summary.trades : '—'}</td>
                      <td className="Amount">
                        {summary?.trades ? `${formatNumber((summary.wins / summary.trades) * 100, language, 1)}%` : '—'}
                      </td>
                      <td className="Amount">{summary ? summary.open : '—'}</td>
                      <td className="Amount">{summary ? formatPrice(summary.price, language) : '—'}</td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </div>
        )}
      </div>
    </div>
  );
};

export default Trading_Live;

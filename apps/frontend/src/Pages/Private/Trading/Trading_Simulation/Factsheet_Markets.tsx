import { useState } from 'react';
import { useNavigate } from 'react-router';
import { useTranslation } from 'react-i18next';
import { useMarketRuns } from '../../../../Hooks/Trading/useMarketRuns';
import type { Market_Instrument } from '../../../../Hooks/Trading/useMarketInstruments';
import { instrumentPair } from '../../../../Hooks/Trading/useMarketInstruments';
import type { Simulation_Run } from '../../../../Hooks/Trading/useSimulation';
import Simple_Button from '../../../../Components/Buttons/Simple_Button/Simple_Button';
import * as Icon from '../../../../Imports/icons';
import Instrument_Picker from '../Trading_Simulator/Instrument_Picker';
import Factsheet_Panel from './Factsheet_Panel';
import { useFactsheetFormat } from './factsheetFormat';
import { activateOnKey } from '../../../../utils/rowKeyboard';

interface Factsheet_Markets_Props {
  run: Simulation_Run;
}

/**
 * 3.7 — A mesma estratégia noutros mercados: escolhem-se os mercados (do mesmo
 * tipo, spot ou futuros) e cada um vira uma simulação nova, com o mesmo
 * período e estratégia, ligada a esta. A tabela mostra a família toda (a
 * original e as outras), com o resultado e o veredicto de cada uma, e abre
 * cada uma ao clicar. Os números vêm do simulador.
 */
const Factsheet_Markets = ({ run }: Factsheet_Markets_Props) => {
  const { t } = useTranslation();
  const navigate = useNavigate();
  const f = useFactsheetFormat('');
  const { runs, loading, create, creating, error } = useMarketRuns(run.id);
  const [chosen, setChosen] = useState<Market_Instrument[]>([]);
  const [warning, setWarning] = useState<string | null>(null);
  const futures = run.instrument.type !== 'spot';
  const taken = new Set(runs.map((item) => item.instrumentId));

  const add = (instrument: Market_Instrument) => {
    setWarning(null);
    if ((instrument.type !== 'spot') !== futures) {
      setWarning(t(futures ? 'trading.fsMarketsOnlyFutures' : 'trading.fsMarketsOnlySpot'));
      return;
    }
    if (taken.has(instrument.id) || chosen.some((item) => item.id === instrument.id)) {
      setWarning(t('trading.fsMarketsAlready'));
      return;
    }
    setChosen((list) => [...list, instrument]);
  };

  const submit = async () => {
    if (await create(chosen.map((item) => item.id))) setChosen([]);
  };

  return (
    <Factsheet_Panel title={t('trading.fsMarketsTitle')} explain="proofMarkets" note={t('trading.fsMarketsNote')}>
      <div className="Factsheet_Markets_Form">
        <div className="Factsheet_Markets_Picker">
          <Instrument_Picker value={null} onChange={add} />
        </div>
        {chosen.map((item) => (
          <button
            key={item.id}
            type="button"
            className="Factsheet_Markets_Chip"
            onClick={() => setChosen((list) => list.filter((other) => other.id !== item.id))}
            title={t('trading.fsMarketsRemove')}
          >
            {instrumentPair(item)}
            <span className="Factsheet_Markets_Chip_Close" aria-hidden="true"><Icon.Close /></span>
          </button>
        ))}
        <Simple_Button
          text={chosen.length ? t('trading.fsMarketsRun', { count: chosen.length }) : t('trading.fsMarketsRunEmpty')}
          small
          auto
          disabled={!chosen.length || creating}
          onClick={submit}
        />
      </div>
      {(warning || error) && <p className="Factsheet_Markets_Error">{warning ?? error}</p>}
      {loading ? (
        <span className="Factsheet_Hint">{t('common.loading')}</span>
      ) : (
        <div className="Factsheet_Table_Scroll">
          <table className="Factsheet_Table">
            <thead>
              <tr>
                <th>{t('trading.runsColumnMarket')}</th>
                <th>{t('trading.runsColumnStatus')}</th>
                <th className="Numeric">{t('trading.runsColumnResult')}</th>
                <th className="Numeric">{t('trading.runsColumnBuyHold')}</th>
                <th className="Numeric">{t('trading.runsColumnTrades')}</th>
                <th className="Numeric">{t('trading.runsColumnWinRate')}</th>
                <th className="Numeric">{t('trading.runsColumnDrawdown')}</th>
                <th>{t('trading.fsMarketsCol_verdict')}</th>
              </tr>
            </thead>
            <tbody>
              {runs.map((item) => (
                <tr
                  key={item.id}
                  className={`Factsheet_Markets_Row${item.id === run.id ? ' Total' : ''}`}
                  onClick={() => item.id !== run.id && navigate(`/Trading/simulacoes/${item.id}?view=proofs`)} tabIndex={item.id !== run.id ? 0 : undefined} onKeyDown={activateOnKey}
                >
                  <td className="Strong">
                    {item.instrument.asset.ticker ?? item.instrument.symbol}/{item.instrument.quote}
                    <span className="Factsheet_Cell_Detail">
                      {item.id === run.id ? t('trading.fsMarketsThis') : item.sourceRunId ? t('trading.fsMarketsCopy') : t('trading.fsMarketsSource')}
                    </span>
                  </td>
                  <td>
                    {item.status === 'running'
                      ? t('trading.runsStatus_running', { progress: item.progress })
                      : t(`trading.runsStatus_${item.status}`)}
                  </td>
                  <td className={`Numeric Strong ${f.tone(item.result?.netProfitPct)}`}>{f.signedPercent(item.result?.netProfitPct)}</td>
                  <td className={`Numeric ${f.tone(item.result?.buyHoldPct)}`}>{f.signedPercent(item.result?.buyHoldPct)}</td>
                  <td className="Numeric">{item.result ? f.number(item.result.trades) : '—'}</td>
                  <td className="Numeric">{f.percent(item.result?.winRate, 1)}</td>
                  <td className="Numeric Negative">{item.result ? `−${f.number(item.result.maxDrawdownPct, 1)}%` : '—'}</td>
                  <td>
                    {item.verdict ? (
                      <span className={`Factsheet_Verdict_Tag ${item.verdict}`}>{t(`trading.fsVerdict_${item.verdict}`)}</span>
                    ) : (
                      '—'
                    )}
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}
    </Factsheet_Panel>
  );
};

export default Factsheet_Markets;

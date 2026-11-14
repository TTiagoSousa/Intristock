import { useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { useTranslation } from 'react-i18next';
import { COMPARE_MAX, canCancelRun, useSimulations, SIMULATIONS_PAGE_SIZE } from '../../../../Hooks/Trading/useSimulations';
import { isActiveStatus } from '../../../../Hooks/Trading/useSimulation';
import type { Simulation_Run_Item } from '../../../../Hooks/Trading/useSimulations';
import Simple_Button from '../../../../Components/Buttons/Simple_Button/Simple_Button';
import Global_Pagination from '../../../../Components/Pagination/Global_Pagination/Global_Pagination';
import * as Icon from '../../../../Imports/icons';
import Delete_Simulations_Popover from './Delete_Simulations_Popover';
import Cancel_Simulation_Popover from './Cancel_Simulation_Popover';
import { useNow } from '../../../../Hooks/useNow';
import { formatDuration, runProgressOf } from '../Trading_Simulator/runProgress';
import { formatDay, formatNumber, formatPct, toneOf } from '../Trading_Simulator/format';
import './Trading_Simulations.scss';

/**
 * As simulações do utilizador, das mais recentes para as mais antigas. Cada
 * linha abre a página dessa simulação. As escolhidas comparam-se (até
 * COMPARE_MAX) ou apagam-se juntas; cada linha também se apaga sozinha e, na
 * fila ou a correr, cancela-se.
 */
const Trading_Simulations = () => {
  const { t, i18n } = useTranslation();
  const navigate = useNavigate();
  const [page, setPage] = useState(1);
  // As escolhidas para comparar ou apagar (ficam ao mudar de página)
  const [selected, setSelected] = useState<string[]>([]);
  const toggle = (id: string) =>
    setSelected((list) => (list.includes(id) ? list.filter((item) => item !== id) : [...list, id]));
  // As que o popover vai apagar: as escolhidas ou a de uma linha
  const [toDelete, setToDelete] = useState<{ ids: string[]; label?: string } | null>(null);
  // A que o popover vai cancelar
  const [toCancel, setToCancel] = useState<Simulation_Run_Item | null>(null);
  const { runs, total, totalPages, loading, reload } = useSimulations(page);

  const marketOf = (run: Simulation_Run_Item) => `${run.instrument.asset.ticker ?? run.instrument.symbol}/${run.instrument.quote}`;

  const onDeleted = (ids: string[]) => {
    setToDelete(null);
    setSelected((list) => list.filter((id) => !ids.includes(id)));
    // Se a página ficou vazia, volta à anterior
    const left = total - ids.length;
    setPage((current) => Math.min(current, Math.max(1, Math.ceil(left / SIMULATIONS_PAGE_SIZE))));
    reload();
  };

  const language = i18n.language;
  // O "faltam" anda de segundo a segundo enquanto alguma corre
  const now = useNow(runs.some((run) => isActiveStatus(run.status)));

  // Enquanto não acaba, o estado diz a fase (velas, fila, simulação, relatório,
  // gravação) e a percentagem dela, com uma barra e o que falta por baixo
  const statusCell = (run: Simulation_Run_Item) => {
    const { stage, percent, endAt } = runProgressOf(run, now);
    if (!stage) {
      return (
        <span className={`Simulation_Run_Status ${run.status}`} title={run.error ?? undefined}>
          {t(`trading.runsStatus_${run.status}`)}
        </span>
      );
    }
    return (
      <span className="Simulation_Run_Live">
        <span className={`Simulation_Run_Status ${run.status}`}>
          {run.status === 'cancelling' ? t('trading.runsStatus_cancelling') : t(`trading.runsStage_${stage}`, { percent })}
        </span>
        <span className="Simulation_Run_Bar" aria-hidden="true">
          <span
            className={`Simulation_Run_Bar_Fill${stage === 'candles' ? ' Candles' : ''}`}
            style={{ width: `${percent}%` }}
          />
        </span>
        <span className="Simulation_Run_Left">
          {run.status === 'cancelling'
            ? t('trading.runsCancellingHint')
            : endAt ? t('trading.runsLeft', { time: formatDuration(endAt - now, t) }) : t('trading.runsLeftUnknown')}
        </span>
      </span>
    );
  };

  return (
    <div className="Trading_Simulations">
      <div className="Page_Card">
        <div className="Card_Header">
          <div className="Card_Header_Text">
            <span className="Card_Title">{t('trading.runsTitle')}</span>
            <span className="Card_Subtitle">{loading ? ' ' : t('trading.runsCount', { count: total })}</span>
          </div>

          <div className="Card_Header_Action">
            {selected.length > 0 && (
              <>
                <Simple_Button
                  text={t('trading.runsDeleteSelected', { count: selected.length })}
                  small
                  variant="Danger"
                  onClick={() => setToDelete({ ids: selected })}
                />
                <Simple_Button
                  text={t('trading.runsCompare', { count: selected.length })}
                  small
                  variant="Ghost"
                  disabled={selected.length < 2 || selected.length > COMPARE_MAX}
                  onClick={() => navigate(`/Trading/simulacoes/comparar?ids=${selected.join(',')}`)}
                />
              </>
            )}
            <Simple_Button text={t('trading.runsNew')} small onClick={() => navigate('/Trading/simulador')} />
          </div>
        </div>

        {loading ? (
          <span className="Empty_Message">{t('common.loading')}</span>
        ) : runs.length === 0 ? (
          <span className="Empty_Message">{t('trading.runsEmpty')}</span>
        ) : (
          <>
            <div className="Trades_Table_Scroll">
              <table className="Trades_Table">
                <thead>
                  <tr>
                    <th className="Simulation_Pick" aria-label={t('trading.runsPick')} />
                    <th>{t('trading.runsColumnMarket')}</th>
                    <th>{t('trading.runsColumnPeriod')}</th>
                    <th>{t('trading.runsColumnStatus')}</th>
                    <th className="Right">{t('trading.runsColumnResult')}</th>
                    <th className="Right">{t('trading.runsColumnBuyHold')}</th>
                    <th className="Right">{t('trading.runsColumnTrades')}</th>
                    <th className="Right">{t('trading.runsColumnWinRate')}</th>
                    <th className="Right">{t('trading.runsColumnDrawdown')}</th>
                    <th>{t('trading.runsColumnCreated')}</th>
                    <th className="Simulation_Actions" aria-label={t('trading.runsActions')} />
                  </tr>
                </thead>

                <tbody>
                  {runs.map((run) => (
                    <tr
                      key={run.id}
                      className="Simulation_Row"
                      onClick={() => navigate(`/Trading/simulacoes/${run.id}`)}
                    >
                      <td className="Simulation_Pick" onClick={(event) => event.stopPropagation()}>
                        <input
                          type="checkbox"
                          checked={selected.includes(run.id)}
                          onChange={() => toggle(run.id)}
                          aria-label={t('trading.runsPick')}
                        />
                      </td>
                      <td>
                        <span className="Simulation_Market">{marketOf(run)}</span>
                        <span className="Simulation_Market_Detail">
                          {t(`trading.type_${run.instrument.type}`)} · {t(`trading.tf_${run.timeframe}`)}
                          {run.sourceRunId && ` · ${t('trading.runsOtherMarket')}`}
                        </span>
                      </td>
                      <td className="Numeric Left">
                        {formatDay(run.fromDate, language)} – {formatDay(run.toDate, language)}
                      </td>
                      <td>{statusCell(run)}</td>
                      <td className={`Amount Simulation_Result ${toneOf(run.result?.netProfitPct ?? null)}`}>
                        {formatPct(run.result?.netProfitPct ?? null, language)}
                      </td>
                      <td className={`Amount ${toneOf(run.result?.buyHoldPct ?? null)}`}>
                        {formatPct(run.result?.buyHoldPct ?? null, language)}
                      </td>
                      <td className="Amount">{run.result ? run.result.trades : '—'}</td>
                      <td className="Amount">
                        {run.result?.winRate == null ? '—' : `${formatNumber(run.result.winRate, language, 1)}%`}
                      </td>
                      <td className="Amount">
                        {run.result ? `${formatNumber(run.result.maxDrawdownPct, language, 1)}%` : '—'}
                      </td>
                      <td className="Numeric Left">
                        {new Date(run.createdAt).toLocaleString(language, {
                          day: '2-digit',
                          month: '2-digit',
                          year: 'numeric',
                          hour: '2-digit',
                          minute: '2-digit',
                        })}
                      </td>
                      <td className="Simulation_Actions" onClick={(event) => event.stopPropagation()}>
                        {canCancelRun(run) && (
                          <button
                            type="button"
                            className="Simulation_Delete"
                            title={t('trading.runsCancel')}
                            aria-label={t('trading.runsCancel')}
                            onClick={() => setToCancel(run)}
                          >
                            <Icon.Ban />
                          </button>
                        )}
                        <button
                          type="button"
                          className="Simulation_Delete"
                          disabled={run.status === 'running' || run.status === 'cancelling'}
                          title={t(
                            run.status === 'running' || run.status === 'cancelling'
                              ? 'trading.runsDeleteRunning'
                              : 'common.delete',
                          )}
                          aria-label={t('common.delete')}
                          onClick={() => setToDelete({ ids: [run.id], label: marketOf(run) })}
                        >
                          <Icon.Trash />
                        </button>
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>

            <Global_Pagination
              page={page}
              totalPages={totalPages}
              onPageChange={setPage}
              totalItems={total}
              pageSize={SIMULATIONS_PAGE_SIZE}
            />
          </>
        )}
      </div>

      {toCancel && (
        <Cancel_Simulation_Popover
          id={toCancel.id}
          label={marketOf(toCancel)}
          running={toCancel.status === 'running'}
          onClose={() => setToCancel(null)}
          onCancelled={() => {
            setToCancel(null);
            reload();
          }}
        />
      )}

      {toDelete && (
        <Delete_Simulations_Popover
          ids={toDelete.ids}
          label={toDelete.label}
          onClose={() => setToDelete(null)}
          onDeleted={onDeleted}
        />
      )}
    </div>
  );
};

export default Trading_Simulations;

import { useTranslation } from 'react-i18next';
import type { Simulation_Run } from '../../../../Hooks/Trading/useSimulation';
import { localeOf } from '../../../../utils/locale';

/**
 * Onde vai a simulação: primeiro as velas (o downloader, mês a mês), depois a
 * simulação de 0 a 100%. A caixa tem sempre a mesma altura, para nada saltar
 * quando muda de fase.
 */
const Simulation_Status = ({ run }: { run: Simulation_Run }) => {
  const { t, i18n } = useTranslation();

  const downloading = run.status === 'queued' && run.download.status !== 'done';
  const formatMonth = (date: string) =>
    new Date(date).toLocaleDateString(localeOf(i18n.language), { month: 'short', year: 'numeric', timeZone: 'UTC' });

  const { message, percent } = (() => {
    if (run.status === 'failed') return { message: t('trading.runFailed', { error: run.error ?? '' }), percent: 100 };
    if (run.status === 'cancelled') return { message: t('trading.runCancelled'), percent: 100 };
    if (run.status === 'cancelling') return { message: t('trading.runCancelling'), percent: run.progress };
    if (downloading) {
      const { monthsDone, monthsTotal, currentMonth } = run.download;
      return {
        message: t('trading.runDownloading', {
          month: Math.min(monthsDone + 1, monthsTotal),
          total: monthsTotal,
          current: currentMonth ? formatMonth(currentMonth) : '',
        }),
        percent: monthsTotal > 0 ? Math.round((monthsDone / monthsTotal) * 100) : 0,
      };
    }
    if (run.status === 'queued') return { message: t('trading.runQueued'), percent: 0 };
    return { message: t('trading.runRunning'), percent: run.progress };
  })();

  const ended = run.status === 'failed' || run.status === 'cancelled';

  return (
    <div className={`Simulation_Status${ended ? ' Failed' : ''}`} role="status">
      <div className="Simulation_Status_Text">
        <span>{message}</span>
        {!ended && (
          <strong className="Simulation_Status_Percent">
            {downloading ? t('trading.phaseCandles') : t('trading.phaseSimulation')} {percent}%
          </strong>
        )}
      </div>

      <div className="Simulation_Progress" aria-hidden="true">
        <div
          className={`Simulation_Progress_Fill${downloading ? ' Candles' : ''}`}
          style={{ width: `${percent}%` }}
        />
      </div>
    </div>
  );
};

export default Simulation_Status;

import { useMemo, useState } from 'react';
import { useTranslation } from 'react-i18next';
import type { Table_Drawdown_Episodes } from '../../../../Hooks/Trading/useSimulation';
import { formatNumber } from '../Trading_Simulator/format';
import Factsheet_Panel from './Factsheet_Panel';

interface Factsheet_Drawdowns_Props {
  table: Table_Drawdown_Episodes;
}

// Quantos se veem no painel; os outros, em ecrã inteiro ("Ver todos")
const VISIBLE = 5;

/**
 * 1.4 — Os piores drawdowns: o início, o fundo, a recuperação (ou "Em curso"),
 * a profundidade e os dias até ao fundo, de recuperação e no total. O painel
 * mostra os 5 piores; "Ver todos" abre-o em ecrã inteiro com a lista toda. Os
 * episódios vêm já calculados e ordenados do pior.
 */
const Factsheet_Drawdowns = ({ table }: Factsheet_Drawdowns_Props) => {
  const { t, i18n } = useTranslation();
  const language = i18n.language;
  const [fullscreen, setFullscreen] = useState(false);
  const episodes = table.episodes;
  const rows = fullscreen ? episodes : episodes.slice(0, VISIBLE);

  const date = useMemo(
    () => new Intl.DateTimeFormat(language, { day: '2-digit', month: '2-digit', year: 'numeric', timeZone: 'UTC' }),
    [language],
  );
  const days = (value: number | null) => (value == null ? '—' : t('trading.fsDrawdownDays', { value: formatNumber(value, language, 0) }));
  const percent = (value: number) => `${value < 0 ? '−' : ''}${formatNumber(Math.abs(value), language, 1)}%`;

  return (
    <Factsheet_Panel
      explain="sumDrawdownEpisodes"
      title={t(fullscreen ? 'trading.fsDrawdownsAllTitle' : 'trading.fsDrawdownsTitle', { count: episodes.length })}
      note={t('trading.fsDrawdownsNote')}
      fullscreen={fullscreen}
      onFullscreenChange={setFullscreen}
      actions={
        !fullscreen &&
        episodes.length > VISIBLE && (
          <button type="button" className="Factsheet_Panel_Button" onClick={() => setFullscreen(true)}>
            {t('trading.fsDrawdownsSeeAll', { count: episodes.length })}
          </button>
        )
      }
    >
      {episodes.length === 0 ? (
        <span className="Factsheet_Hint">{t('trading.fsDrawdownsNone')}</span>
      ) : (
        <div className="Factsheet_Table_Scroll">
          <table className="Factsheet_Table">
            <thead>
              <tr>
                <th className="Numeric">#</th>
                <th>{t('trading.fsDrawdownStart')}</th>
                <th>{t('trading.fsDrawdownTrough')}</th>
                <th>{t('trading.fsDrawdownRecovered')}</th>
                <th className="Numeric">{t('trading.fsDrawdownDepth')}</th>
                <th className="Numeric">{t('trading.fsDrawdownToTrough')}</th>
                <th className="Numeric">{t('trading.fsDrawdownRecovery')}</th>
                <th className="Numeric">{t('trading.fsDrawdownTotal')}</th>
              </tr>
            </thead>
            <tbody>
              {rows.map((row, i) => (
                <tr key={row.startTime}>
                  <td className="Numeric">{i + 1}</td>
                  <td className="Numeric Left">{date.format(new Date(row.startTime))}</td>
                  <td className="Numeric Left">{date.format(new Date(row.troughTime))}</td>
                  <td className="Numeric Left">
                    {row.recoveryTime == null ? t('trading.fsDrawdownOngoing') : date.format(new Date(row.recoveryTime))}
                  </td>
                  <td className="Numeric Negative">{percent(row.depthPct)}</td>
                  <td className="Numeric">{days(row.daysToTrough)}</td>
                  <td className="Numeric">{days(row.recoveryDays)}</td>
                  <td className="Numeric">{days(row.totalDays)}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}
    </Factsheet_Panel>
  );
};

export default Factsheet_Drawdowns;

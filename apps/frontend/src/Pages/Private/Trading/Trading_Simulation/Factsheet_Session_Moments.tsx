import { useTranslation } from 'react-i18next';
import type { Funding_Hours, Session_Moments } from '../../../../Hooks/Trading/useSimulation';
import Factsheet_Panel from './Factsheet_Panel';
import { hourLabel, useFactsheetFormat } from './factsheetFormat';

interface Factsheet_Session_Moments_Props {
  moments: Session_Moments;
  funding: Funding_Hours;
  unit: string;
  // O nome do fuso na coluna da hora local (ex.: "Lisboa")
  zoneName: string;
}

// "13:30" → "13h30", "01:00" → "01h"
const clock = (text: string) => {
  const [hours, minutes] = text.split(':');
  return `${hours}h${minutes === '00' ? '' : minutes}`;
};

/**
 * 5.7 — Os momentos-chave da sessão (o fecho da vela diária às 00h UTC e a
 * abertura e o fecho de Nova Iorque, na hora de lá) e as três cobranças de
 * funding: quantas vezes havia posição aberta, a % e o resultado dos trades que
 * lá estavam ou o funding que custaram. A hora local mostra as horas em que o
 * momento cai no fuso da simulação (mudam com a hora de verão). Tudo vem
 * calculado.
 */
const Factsheet_Session_Moments = ({ moments, funding, unit, zoneName }: Factsheet_Session_Moments_Props) => {
  const { t } = useTranslation();
  const f = useFactsheetFormat(unit);
  const local = (times: string[]) => (times.length ? times.map(clock).join(' / ') : '—');

  return (
    <div className="Factsheet_Stack">
      <Factsheet_Panel title={t('trading.fsSessionTitle')} explain="hoursSessionMoments" note={t('trading.fsSessionNote')}>
        <div className="Factsheet_Table_Scroll">
          <table className="Factsheet_Table">
            <thead>
              <tr>
                <th>{t('trading.fsSessionCol_moment')}</th>
                <th>{t('trading.fsSessionCol_local', { zone: zoneName })}</th>
                <th className="Numeric">{t('trading.fsSessionCol_withPosition')}</th>
                <th className="Numeric">{t('trading.fsSessionCol_pctDays')}</th>
                <th className="Numeric">{t('trading.fsHourCol_trades')}</th>
                <th className="Numeric">{t('trading.fsSessionCol_pnl')}</th>
              </tr>
            </thead>
            <tbody>
              {moments.moments.map((row) => (
                <tr key={row.moment}>
                  <td className="Strong">{t(`trading.fsSessionMoment_${row.moment}`)}</td>
                  <td className="Numeric Left">{local(row.localTimes)}</td>
                  <td className="Numeric">{f.number(row.withPosition)}</td>
                  <td className="Numeric">{f.percent(row.pct, 0)}</td>
                  <td className="Numeric">{f.number(row.trades)}</td>
                  <td className={`Numeric Strong ${f.tone(row.pnl)}`}>{f.money(row.pnl)}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </Factsheet_Panel>
      <Factsheet_Panel title={t('trading.fsFundingTitle')} explain="hoursFunding" note={t('trading.fsFundingNote')}>
        <div className="Factsheet_Table_Scroll">
          <table className="Factsheet_Table">
            <thead>
              <tr>
                <th>{t('trading.fsFundingCol_charge')}</th>
                <th>{t('trading.fsSessionCol_local', { zone: zoneName })}</th>
                <th className="Numeric">{t('trading.fsSessionCol_withPosition')}</th>
                <th className="Numeric">{t('trading.fsFundingCol_pct')}</th>
                <th className="Numeric">{t('trading.fsFundingCol_paid')}</th>
              </tr>
            </thead>
            <tbody>
              {funding.charges.map((row) => (
                <tr key={row.hour}>
                  <td className="Strong">{hourLabel(row.hour)}</td>
                  <td className="Numeric Left">{local(row.localTimes)}</td>
                  <td className="Numeric">{f.number(row.withPosition)}</td>
                  <td className="Numeric">{f.percent(row.pct, 0)}</td>
                  {/* Pago é positivo: no P&L é custo (a laranja); recebido, a azul */}
                  <td className={`Numeric ${row.paid == null ? '' : f.tone(-row.paid)}`}>{f.money(row.paid == null ? null : -row.paid, 2)}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
        {!funding.funding && <p className="Factsheet_Panel_Footnote">{t('trading.fsFundingNone')}</p>}
      </Factsheet_Panel>
    </div>
  );
};

export default Factsheet_Session_Moments;

import { useState } from 'react';
import { useNavigate } from 'react-router';
import { useTranslation } from 'react-i18next';
import { useCurrencyFormat } from '../../../../Hooks/useCurrencyFormat';
import { formatDuration, useTimeClients, useTimePeople, useTimeSummary } from '../../../../Hooks/Companies/useTimeTracking';
import { useCompany } from '../../../../Contexts/Company_Context';
import Time_Settle_Popover from './Time_Settle_Popover';
import Month_Chart from '../../../../Components/Charts/Month_Chart/Month_Chart';
import Simple_Button from '../../../../Components/Buttons/Simple_Button/Simple_Button';
import Time_Tracking_Shell from './Time_Tracking_Shell';
import { localeOf } from '../../../../utils/locale';

const PERIODS = [6, 12, 24] as const;
// No gráfico, os clientes que mais valem têm cor; o resto junta-se em «Outros»
const CHART_CLIENTS = 5;

const Overview_Body = ({ company }: { company: { id: string; slug: string } }) => {
  const { t, i18n } = useTranslation();
  const navigate = useNavigate();
  const { formatMaybeIn } = useCurrencyFormat();
  const locale = localeOf(i18n.language);
  const [months, setMonths] = useState<number>(12);
  const { data, error, reload } = useTimeSummary(company.id, months);
  const { can } = useCompany();
  const canManage = can('timesheet.manage');
  const [settling, setSettling] = useState(false);
  // Os clientes e as pessoas vêm logo para quem pode marcar como pago: assim o
  // botão abre a janela de imediato (antes parecia não fazer nada enquanto carregavam)
  const { data: clients, reload: reloadClients } = useTimeClients(canManage ? company.id : undefined);
  const { data: people } = useTimePeople(canManage ? company.id : undefined);

  // Sem ligações não há moeda: só o número, sem inventar «€»
  const code = data?.currency?.shortCode ?? '';
  const format = (value: number) => formatMaybeIn(value, code);
  const compact = (value: number) =>
    new Intl.NumberFormat(locale, { notation: 'compact', maximumFractionDigits: 1 }).format(value);
  const monthDate = (month: string) => new Date(`${month}-01T00:00:00Z`);
  const base = `/Companies/${company.slug}/horas`;

  if (data && data.connections === 0) {
    return (
      <>
        <div className="Page_Head">
          <h1>{t('timeTracking.title')}</h1>
        </div>
        <div className="Card">
          <div className="Empty_State">
            <span className="Empty_State_Title">{t('timeTracking.noConnectionTitle')}</span>
            <span className="Empty_State_Text">{t('timeTracking.noConnectionText')}</span>
            {canManage && (
              <Simple_Button text={t('timeTracking.addConnection')} onClick={() => navigate(`/Companies/${company.slug}/definicoes/apps`)} auto />
            )}
          </div>
        </div>
      </>
    );
  }

  const cards = data?.cards;
  const top = (data?.byClient ?? []).slice(0, CHART_CLIENTS);
  const topKeys = new Set(top.map((client) => client.key));
  const points = data?.months ?? [];
  const series = [
    ...top.map((client, index) => ({
      id: client.key,
      name: client.name ?? t('timeTracking.noClient'),
      values: points.map((point) => point.byClient[client.key] || null),
      colorToken: `--time-tracking-client-${index + 1}`,
    })),
    {
      id: 'other',
      name: t('timeTracking.otherClients'),
      values: points.map(
        (point) =>
          Object.entries(point.byClient)
            .filter(([key]) => !topKeys.has(key))
            .reduce((sum, [, value]) => sum + value, 0) || null,
      ),
      colorToken: '--time-tracking-client-other',
    },
  ].filter((part) => part.values.some((value) => value));
  const hasData = series.length > 0;
  const clientMax = Math.max(...(data?.byClient ?? []).map((client) => client.amount), 1);
  const hoursChange = cards ? cards.secondsThisMonth - cards.secondsPreviousMonth : 0;

  return (
    <>
      <div className="Page_Head">
        <h1>{t('timeTracking.title')}</h1>
        {canManage && (
          <Simple_Button
            text={t('timeTracking.settleAction')}
            onClick={() => setSettling(true)}
            disabled={!clients || !people}
            auto
          />
        )}
      </div>
      {error && <span className="Time_Tracking_Message Bad">{error}</span>}
      {settling && clients && people && (
        <Time_Settle_Popover
          companyId={company.id}
          clients={clients}
          people={people}
          currencyCode={code}
          initial={{}}
          onClose={() => setSettling(false)}
          onDone={() => {
            setSettling(false);
            reload();
            reloadClients();
          }}
        />
      )}

      <div className="Grid Auto_190">
        <div className="Card Tile Wave_Tile Accent Big">
          <span className="Eyebrow">{t('timeTracking.cardHoursMonth')}</span>
          <span className="Tile_Value">{cards ? formatDuration(cards.secondsThisMonth) : '—'}</span>
          <div className="Tile_Foot">
            {cards
              ? t(hoursChange >= 0 ? 'timeTracking.cardHoursMore' : 'timeTracking.cardHoursLess', {
                  hours: formatDuration(Math.abs(hoursChange)),
                })
              : ''}
          </div>
        </div>
        <div className="Card Tile Wave_Tile">
          <span className="Eyebrow">{t('timeTracking.cardWorthMonth')}</span>
          <span className="Tile_Value">{cards ? format(cards.amountThisMonth) : '—'}</span>
          <div className="Tile_Foot">
            {cards ? t('timeTracking.cardWorthPeriod', { count: months, amount: format(cards.amountPeriod) }) : ''}
          </div>
        </div>
        <div className="Card Tile Wave_Tile Up">
          <span className="Eyebrow">{t('timeTracking.cardReceived', { count: months })}</span>
          <span className="Tile_Value">{cards ? format(cards.received) : '—'}</span>
          <div className="Tile_Foot">
            {cards ? t('timeTracking.cardReceivedFoot', { gross: format(cards.receivedGross) }) : ''}
          </div>
        </div>
        <div className={`Card Tile Wave_Tile ${cards && cards.pending > 0 ? 'Warn' : 'Gold'}`}>
          <span className="Eyebrow">{t('timeTracking.cardPending')}</span>
          <span className="Tile_Value">{cards ? format(cards.pending) : '—'}</span>
          <div className="Tile_Foot">
            {cards
              ? t('timeTracking.cardPendingFoot', {
                  hours: formatDuration(cards.pendingSeconds),
                  count: cards.pendingClients,
                })
              : ''}
          </div>
        </div>
      </div>

      <div className="Card Time_Tracking_Card">
        <div className="Card_Header">
          <div className="Card_Header_Text">
            <span className="Card_Title">{t('timeTracking.chartTitle')}</span>
            <span className="Card_Subtitle">{t('timeTracking.chartSubtitle', { currency: code })}</span>
          </div>
          <div className="Time_Tracking_Controls">
            <div className="Tabs">
              {PERIODS.map((period) => (
                <button
                  key={period}
                  type="button"
                  className={months === period ? 'Active' : ''} aria-pressed={months === period}
                  onClick={() => setMonths(period)}
                >
                  {t('purchasesDashboard.months', { count: period })}
                </button>
              ))}
            </div>
            <Simple_Button text={t('timeTracking.seeHours')} onClick={() => navigate(`${base}/registo`)} variant="Ghost" small auto />
          </div>
        </div>
        <div className="Time_Tracking_Chart">
          {!data ? (
            <span className="Time_Tracking_Message">{t('common.loading')}</span>
          ) : !hasData ? (
            <span className="Time_Tracking_Message">{t('timeTracking.noHours')}</span>
          ) : (
            <Month_Chart
              kind="bars"
              categories={points.map(
                (point) =>
                  `${monthDate(point.month).toLocaleDateString(locale, { month: 'short', timeZone: 'UTC' }).replace('.', '')} ${point.month.slice(2, 4)}`,
              )}
              labels={points.map((point) =>
                monthDate(point.month).toLocaleDateString(locale, { month: 'long', year: 'numeric', timeZone: 'UTC' }),
              )}
              series={series}
              stacked
              format={format}
              compact={compact}
            />
          )}
        </div>
      </div>

      <div className="Time_Tracking_Panels">
        <div className="Card Time_Tracking_Card">
          <div className="Card_Header">
            <div className="Card_Header_Text">
              <span className="Card_Title">{t('timeTracking.byClientTitle')}</span>
              <span className="Card_Subtitle">{t('timeTracking.byClientSubtitle', { count: months })}</span>
            </div>
          </div>
          <div className="Time_Tracking_Body">
            {!data || data.byClient.length === 0 ? (
              <span className="Time_Tracking_Message">{t('timeTracking.noHours')}</span>
            ) : (
              <div className="Time_Tracking_Shares">
                {data.byClient.map((client) => (
                  <div key={client.key} className="Time_Tracking_Share">
                    <div className="Time_Tracking_Share_Head">
                      <span>
                        {client.name ?? t('timeTracking.noClient')}
                        <span className="Time_Tracking_Sub Num"> · {formatDuration(client.seconds)}</span>
                      </span>
                      <span className="Num">{format(client.amount)}</span>
                    </div>
                    <div className="Time_Tracking_Share_Track">
                      <div className="Time_Tracking_Share_Fill" style={{ width: `${(client.amount / clientMax) * 100}%` }} />
                    </div>
                    {client.unpaid > 0 && (
                      <span className="Time_Tracking_Sub">{t('timeTracking.clientUnpaid', { amount: format(client.unpaid) })}</span>
                    )}
                  </div>
                ))}
              </div>
            )}
          </div>
        </div>

        <div className="Card Time_Tracking_Card">
          <div className="Card_Header">
            <div className="Card_Header_Text">
              <span className="Card_Title">{t('timeTracking.paymentsTitle')}</span>
            </div>
          </div>
          <div className="Time_Tracking_Body">
            {!data || data.settlements.length === 0 ? (
              <span className="Time_Tracking_Message">{t('timeTracking.paymentsEmpty')}</span>
            ) : (
              <div className="Time_Tracking_List">
                {data.settlements.map((settlement) => (
                  <div key={settlement.id} className="Time_Tracking_List_Row">
                    <div className="Time_Tracking_List_Text">
                      <span className="Time_Tracking_Strong">{settlement.client.name}</span>
                      <span className="Time_Tracking_Sub">
                        {new Date(`${settlement.paidAt}T00:00:00Z`).toLocaleDateString(locale, { timeZone: 'UTC' })} ·{' '}
                        {formatDuration(settlement.seconds)}
                      </span>
                    </div>
                    <div className="Time_Tracking_List_Text Right">
                      <span className="Num">{format(settlement.netAmount)}</span>
                      {settlement.recorded && <span className="Time_Tracking_Sub">{t('timeTracking.recordedInCompany')}</span>}
                    </div>
                  </div>
                ))}
              </div>
            )}
          </div>
        </div>
      </div>
    </>
  );
};

/** A visão geral do banco de horas: os cartões, o valor de cada mês por cliente, as somas por cliente e os últimos pagamentos. */
const Time_Tracking_Overview = () => (
  <Time_Tracking_Shell>{(company) => <Overview_Body company={company} />}</Time_Tracking_Shell>
);

export default Time_Tracking_Overview;

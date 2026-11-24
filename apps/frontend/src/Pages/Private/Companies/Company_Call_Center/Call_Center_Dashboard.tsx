import { useState } from 'react';
import { useTranslation } from 'react-i18next';
import Global_Dropdown from '../../../../Components/Inputs/Global_Dropdown/Global_Dropdown';
import Month_Chart from '../../../../Components/Charts/Month_Chart/Month_Chart';
import { useCompany } from '../../../../Contexts/Company_Context';
import { useLeadDashboard, type Lead_Dashboard } from '../../../../Hooks/Companies/useCompanyLeads';
import { localeOf } from '../../../../utils/locale';
import Data_Shell from './Data_Shell';
import './Call_Center_Dashboard.scss';

const RANGES = [7, 30, 90] as const;
type Range = (typeof RANGES)[number];
const ALL = '__all';
const DAY_MS = 86_400_000;

/** Os dias de hoje para trás (o período), com o fim amanhã à meia-noite para apanhar o dia de hoje todo. */
const periodOf = (days: Range) => {
  const end = new Date();
  end.setHours(24, 0, 0, 0);
  return { from: new Date(end.getTime() - days * DAY_MS).toISOString(), to: end.toISOString() };
};

const Stat = ({ label, value, note, tone }: { label: string; value: string; note?: string; tone?: 'warn' }) => (
  <div className={`Card Cc_Dash_Stat${tone ? ` ${tone}` : ''}`}>
    <span className="Cc_Dash_Stat_Label">{label}</span>
    <span className="Cc_Dash_Stat_Value">{value}</span>
    {note && <span className="Cc_Dash_Stat_Note">{note}</span>}
  </div>
);

const Dashboard_Body = ({ data }: { data: Lead_Dashboard }) => {
  const { t, i18n } = useTranslation();
  const locale = localeOf(i18n.language);
  const number = (value: number) => value.toLocaleString(locale);
  const percent = (value: number | null) => (value === null ? '—' : value.toLocaleString(locale, { style: 'percent', maximumFractionDigits: 0 }));
  const days = (value: number | null) => (value === null ? '—' : t('callCenter.dashDays', { value: value.toLocaleString(locale, { maximumFractionDigits: 1 }) }));

  const dates = data.byDay.map((d) => new Date(`${d.day}T12:00:00`));
  const chart = {
    categories: dates.map((d) => d.toLocaleDateString(locale, { day: 'numeric', month: 'short' })),
    labels: dates.map((d) => d.toLocaleDateString(locale, { weekday: 'long', day: 'numeric', month: 'long' })),
    series: [
        { id: 'answered', name: t('callCenter.dashAnswered'), values: data.byDay.map((d) => d.answered), colorToken: '--cc-dash-answered', stack: 'calls' },
        { id: 'missed', name: t('callCenter.dashMissed'), values: data.byDay.map((d) => d.calls - d.answered), colorToken: '--cc-dash-missed', stack: 'calls' },
      ],
  };
  const maxOutcome = Math.max(1, ...data.byOutcome.map((o) => o.count));
  const boardName = new Map(data.boards.map((b) => [b.id, b.name]));
  const multiBoard = data.boards.length > 1;

  return (
    <>
      <div className="Cc_Dash_Stats">
        <Stat label={t('callCenter.dashCalls')} value={number(data.cards.calls)} note={t('callCenter.dashLeadsCalled', { count: data.cards.leadsCalled })} />
        <Stat label={t('callCenter.dashAnswerRate')} value={percent(data.cards.answerRate)} note={t('callCenter.dashAnsweredCount', { count: data.cards.answered })} />
        <Stat label={t('callCenter.dashOpen')} value={number(data.cards.open)} note={t('callCenter.dashUnassigned', { count: data.cards.unassigned })} />
        <Stat
          label={t('callCenter.dashCallbacks')}
          value={number(data.cards.callbacksToday + data.cards.callbacksOverdue)}
          note={t('callCenter.dashOverdue', { count: data.cards.callbacksOverdue })}
          tone={data.cards.callbacksOverdue > 0 ? 'warn' : undefined}
        />
      </div>

      <div className="Card Cc_Dash_Chart">
        <div className="Card_Header">
          <div className="Card_Header_Text">
            <span className="Card_Title">{t('callCenter.dashByDay')}</span>
            <span className="Card_Subtitle">{t('callCenter.dashByDayHint')}</span>
          </div>
        </div>
        {data.cards.calls === 0 ? (
          <div className="Empty_State">
            <span className="Empty_State_Title">{t('callCenter.dashNoCallsTitle')}</span>
            <span className="Empty_State_Text">{t('callCenter.dashNoCallsText')}</span>
          </div>
        ) : (
          <div className="Cc_Dash_Chart_Body">
            <Month_Chart kind="bars" stacked categories={chart.categories} labels={chart.labels} series={chart.series} format={number} compact={number} />
          </div>
        )}
      </div>

      <div className="Cc_Dash_Grid">
        <div className="Card Call_Center_Card">
          <div className="Card_Header">
            <div className="Card_Header_Text">
              <span className="Card_Title">{t('callCenter.dashByUser')}</span>
            </div>
          </div>
          {data.byUser.length === 0 ? (
            <span className="Call_Center_Message">{t('callCenter.dashNoCallsShort')}</span>
          ) : (
            <div className="Table_Wrap">
              <table className="Table">
                <thead>
                  <tr>
                    <th>{t('callCenter.dashOperator')}</th>
                    <th className="Right">{t('callCenter.dashCalls')}</th>
                    <th className="Right">{t('callCenter.dashAnswered')}</th>
                    <th className="Right">{t('callCenter.dashAnswerRate')}</th>
                    <th className="Right">{t('callCenter.dashLeads')}</th>
                  </tr>
                </thead>
                <tbody>
                  {data.byUser.map((row) => (
                    <tr key={row.userId}>
                      <td>{row.name ?? t('callCenter.leadsSomeone')}</td>
                      <td className="Right Num">{number(row.calls)}</td>
                      <td className="Right Num">{number(row.answered)}</td>
                      <td className="Right Num">{percent(row.answerRate)}</td>
                      <td className="Right Num">{number(row.leads)}</td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          )}
        </div>

        <div className="Card Call_Center_Card">
          <div className="Card_Header">
            <div className="Card_Header_Text">
              <span className="Card_Title">{t('callCenter.dashByOutcome')}</span>
            </div>
          </div>
          {data.byOutcome.length === 0 ? (
            <span className="Call_Center_Message">{t('callCenter.dashNoCallsShort')}</span>
          ) : (
            <ul className="Cc_Dash_Bars">
              {data.byOutcome.map((row) => (
                <li key={row.name}>
                  <span className="Cc_Dash_Bars_Name">{row.name}</span>
                  <span className="Cc_Dash_Bars_Track" aria-hidden="true">
                    <span className="Cc_Dash_Bars_Fill" style={{ width: `${(row.count / maxOutcome) * 100}%` }} />
                  </span>
                  <span className="Cc_Dash_Bars_Value">{number(row.count)}</span>
                </li>
              ))}
            </ul>
          )}
        </div>
      </div>

      <div className="Card Call_Center_Card">
        <div className="Card_Header">
          <div className="Card_Header_Text">
            <span className="Card_Title">{t('callCenter.dashStages')}</span>
            <span className="Card_Subtitle">{t('callCenter.dashStagesHint')}</span>
          </div>
        </div>
        <div className="Table_Wrap">
          <table className="Table">
            <thead>
              <tr>
                <th>{t('callCenter.dashStage')}</th>
                {multiBoard && <th>{t('callCenter.dashBoard')}</th>}
                <th className="Right">{t('callCenter.dashNow')}</th>
                <th className="Right">{t('callCenter.dashAvgNow')}</th>
                <th className="Right">{t('callCenter.dashEntered')}</th>
                <th className="Right">{t('callCenter.dashAvgToLeave')}</th>
              </tr>
            </thead>
            <tbody>
              {data.stages.map((row) => (
                <tr key={row.id}>
                  <td>{row.name}</td>
                  {multiBoard && <td className="Call_Center_Sub">{boardName.get(row.boardId) ?? '—'}</td>}
                  <td className="Right Num">{number(row.now)}</td>
                  <td className="Right Num">{days(row.avgDaysNow)}</td>
                  <td className="Right Num">{number(row.entered)}</td>
                  <td className="Right Num">{days(row.avgDaysToLeave)}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </div>
    </>
  );
};

/**
 * O dashboard do call center: as chamadas do período (quantas, atendidas, por dia, por operador e por resultado), as
 * leads abertas e por atribuir, o voltar a ligar de hoje e em atraso, e o tempo em cada coluna. Uma secção ou todas.
 */
const Dashboard_Page = ({ companyId }: { companyId: string }) => {
  const { t } = useTranslation();
  const [range, setRange] = useState<Range>(30);
  const [boardId, setBoardId] = useState<string>(ALL);
  const [period] = useState(() => new Map(RANGES.map((r) => [r, periodOf(r)])));
  const tz = Intl.DateTimeFormat().resolvedOptions().timeZone;
  const { data, error } = useLeadDashboard(companyId, { ...period.get(range)!, boardId: boardId === ALL ? undefined : boardId, tz });
  const { can } = useCompany();

  return (
    <>
      <div className="Page_Head Cc_Dash_Head">
        <div className="Tabs" role="group" aria-label={t('callCenter.dashPeriod')}>
          {RANGES.map((option) => (
            <button key={option} type="button" className={range === option ? 'Active' : ''} aria-pressed={range === option} onClick={() => setRange(option)}>
              {t('callCenter.dashRange', { count: option })}
            </button>
          ))}
        </div>
        {data && data.boards.length > 0 && (
          <div className="Cc_Dash_Board">
            <label htmlFor="cc-dash-board" className="Leads_Visually_Hidden">{t('callCenter.dashBoard')}</label>
            <Global_Dropdown
              id="cc-dash-board"
              value={boardId}
              onChange={(next) => setBoardId(String(next))}
              options={[{ value: ALL, label: t('callCenter.dashAllBoards') }, ...data.boards.map((b) => ({ value: b.id, label: b.name }))]}
            />
          </div>
        )}
      </div>
      {!can('leads.view') && <span className="Call_Center_Message">{t('callCenter.dashNoAccess')}</span>}
      {error && !data && <span className="Call_Center_Message Bad">{error}</span>}
      {!data && !error && <span className="Call_Center_Message">{t('common.loading')}</span>}
      {data && data.boards.length === 0 && (
        <div className="Empty_State">
          <span className="Empty_State_Title">{t('callCenter.dashNoBoardsTitle')}</span>
          <span className="Empty_State_Text">{t('callCenter.dashNoBoardsText')}</span>
        </div>
      )}
      {data && data.boards.length > 0 && <Dashboard_Body data={data} />}
    </>
  );
};

const Call_Center_Dashboard = () => <Data_Shell>{(company) => <Dashboard_Page companyId={company.id} />}</Data_Shell>;

export default Call_Center_Dashboard;

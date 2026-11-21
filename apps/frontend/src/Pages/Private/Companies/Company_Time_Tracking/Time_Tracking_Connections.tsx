import { useId, useState } from 'react';
import { useTranslation } from 'react-i18next';
import { useAlert } from '../../../../Contexts/Alert_Context';
import { useCompany } from '../../../../Contexts/Company_Context';
import { localeOf } from '../../../../utils/locale';
import { getErrorMessage } from '../../../../Hooks/useAsyncRequest';
import { timeTrackingApi, useTimeConnections, type Time_Connection } from '../../../../Hooks/Companies/useTimeTracking';
import Simple_Button from '../../../../Components/Buttons/Simple_Button/Simple_Button';
import Confirm_Popover from '../../../../Components/Confirm_Popover/Confirm_Popover';
import Time_Connection_Popover from './Time_Connection_Popover';
import Time_Tracking_Shell from './Time_Tracking_Shell';

const INTERVALS = [1, 24, 168] as const;

const Connections_Body = ({ company }: { company: { id: string } }) => {
  const { t, i18n } = useTranslation();
  const groupId = useId();
  const { setAlert } = useAlert();
  const locale = localeOf(i18n.language);
  // Quem só vê o banco de horas vê as ligações, sem as gerir
  const { can } = useCompany();
  const canManage = can('timesheet.manage');
  const { data, error, reload } = useTimeConnections(company.id);
  const [adding, setAdding] = useState(false);
  const [deleting, setDeleting] = useState<Time_Connection | null>(null);
  const [busy, setBusy] = useState<string | null>(null);
  // O intervalo escolhido fica marcado logo, antes da resposta (e volta atrás se
  // falhar); vale até chegarem as ligações outra vez (`seen`, os dados de então)
  const [intervals, setIntervals] = useState<{ seen: typeof data; values: Record<string, number> }>({
    seen: data,
    values: {},
  });
  const pendingInterval = (id: string) => (intervals.seen === data ? intervals.values[id] : undefined);

  const chooseInterval = async (id: string, hours: number) => {
    setIntervals((current) => ({
      seen: data,
      values: { ...(current.seen === data ? current.values : {}), [id]: hours },
    }));
    const ok = await run(id, () => timeTrackingApi.updateConnection(company.id, id, { syncEveryHours: hours }));
    if (!ok)
      setIntervals((current) => {
        const values = { ...current.values };
        delete values[id];
        return { ...current, values };
      });
  };

  const run = async (id: string, action: () => Promise<unknown>, message?: string) => {
    setBusy(id);
    try {
      await action();
      if (message) setAlert({ open: true, message, type: 'success' });
      reload();
      return true;
    } catch (reason) {
      setAlert({ open: true, message: getErrorMessage(reason), type: 'error' });
      return false;
    } finally {
      setBusy(null);
    }
  };

  const statusOf = (connection: Time_Connection) =>
    connection.syncing
      ? { tone: 'Info', text: t('timeTracking.statusSyncing') }
      : connection.status === 'paused'
        ? { tone: '', text: t('timeTracking.statusPaused') }
        : connection.status === 'error'
          ? { tone: 'Bad', text: t('timeTracking.statusError') }
          : { tone: 'Ok', text: t('timeTracking.statusActive') };

  return (
    <>
      <div className="Page_Head">
        <div>
          <h1>{t('timeTracking.connectionsTitle')}</h1>
          <div className="Page_Head_Sub">{t('timeTracking.connectionsSubtitle')}</div>
        </div>
        {canManage && <Simple_Button text={t('timeTracking.addConnection')} onClick={() => setAdding(true)} auto />}
      </div>
      {error && <span className="Time_Tracking_Message Bad">{error}</span>}

      {!data ? (
        <span className="Time_Tracking_Message">{t('common.loading')}</span>
      ) : data.length === 0 ? (
        <div className="Card">
          <div className="Empty_State">
            <span className="Empty_State_Title">{t('timeTracking.noConnectionTitle')}</span>
            <span className="Empty_State_Text">{t('timeTracking.noConnectionText')}</span>
          </div>
        </div>
      ) : (
        data.map((connection) => {
          const status = statusOf(connection);
          return (
            <div key={connection.id} className="Card Time_Tracking_Card">
              <div className="Card_Header">
                <div className="Card_Header_Text">
                  <span className="Card_Title">{connection.organizationName}</span>
                  <span className="Card_Subtitle">
                    solidtime · {connection.baseUrl} · {connection.currency.shortCode}
                  </span>
                </div>
                <span className={`Pill ${status.tone}`}>
                  <span className="Dot" />
                  {status.text}
                </span>
              </div>
              <div className="Time_Tracking_Body">
                <div className="Time_Tracking_Facts">
                  <span>
                    <span className="Time_Tracking_Sub">{t('timeTracking.factClients')}</span>{' '}
                    <span className="Num">{connection._count.clients}</span>
                  </span>
                  <span>
                    <span className="Time_Tracking_Sub">{t('timeTracking.factProjects')}</span>{' '}
                    <span className="Num">{connection._count.projects}</span>
                  </span>
                  <span>
                    <span className="Time_Tracking_Sub">{t('timeTracking.factPeople')}</span>{' '}
                    <span className="Num">{connection._count.people}</span>
                  </span>
                  <span>
                    <span className="Time_Tracking_Sub">{t('timeTracking.factEntries')}</span>{' '}
                    <span className="Num">{connection._count.entries}</span>
                  </span>
                  <span>
                    <span className="Time_Tracking_Sub">{t('timeTracking.factSynced')}</span>{' '}
                    {connection.syncedAt ? new Date(connection.syncedAt).toLocaleString(locale) : t('timeTracking.never')}
                  </span>
                </div>
                {connection.lastError && <span className="Field_Hint Time_Tracking_Error">{connection.lastError}</span>}
                <div className="Time_Tracking_Filter">
                  <span className="Eyebrow" id={`${groupId}-syncEvery-${connection.id}`}>{t('timeTracking.syncEvery')}</span>
                  <div className="Tabs" role="group" aria-labelledby={`${groupId}-syncEvery-${connection.id}`}>
                    {INTERVALS.map((hours) => (
                      <button
                        key={hours}
                        type="button"
                        className={(pendingInterval(connection.id) ?? connection.syncEveryHours) === hours ? 'Active' : ''}
                        aria-pressed={(pendingInterval(connection.id) ?? connection.syncEveryHours) === hours}
                        disabled={!canManage}
                        onClick={() => void chooseInterval(connection.id, hours)}
                      >
                        {t(`timeTracking.every_${hours}`)}
                      </button>
                    ))}
                  </div>
                </div>
              </div>
              {canManage && (
              <div className="Time_Tracking_Foot">
                <Simple_Button
                  text={t('timeTracking.syncNow')}
                  onClick={() =>
                    void run(connection.id, () => timeTrackingApi.sync(company.id, connection.id), t('timeTracking.synced'))
                  }
                  disabled={busy !== null || connection.syncing}
                  variant="Ghost"
                  small
                  auto
                />
                <Simple_Button
                  text={connection.status === 'paused' ? t('timeTracking.resume') : t('timeTracking.pause')}
                  onClick={() =>
                    void run(connection.id, () =>
                      timeTrackingApi.updateConnection(company.id, connection.id, { paused: connection.status !== 'paused' }),
                    )
                  }
                  disabled={busy !== null}
                  variant="Quiet"
                  small
                  auto
                />
                <Simple_Button text={t('common.delete')} onClick={() => setDeleting(connection)} variant="Quiet" small auto />
              </div>
              )}
            </div>
          );
        })
      )}

      {adding && (
        <Time_Connection_Popover
          companyId={company.id}
          onClose={() => setAdding(false)}
          onConnected={() => {
            setAdding(false);
            setAlert({ open: true, message: t('timeTracking.connected'), type: 'success' });
            reload();
          }}
        />
      )}

      {deleting && (
        <Confirm_Popover
          title={t('timeTracking.deleteTitle')}
          subtitle={deleting.organizationName}
          message={t('timeTracking.deleteConfirm')}
          confirmText={t('common.delete')}
          busy={busy === deleting.id}
          onClose={() => setDeleting(null)}
          onConfirm={async () => {
            if (await run(deleting.id, () => timeTrackingApi.deleteConnection(company.id, deleting.id))) setDeleting(null);
          }}
        />
      )}
    </>
  );
};

/** As ligações da empresa ao solidtime: o estado, o que veio, o intervalo, sincronizar já, pausar e apagar. */
const Time_Tracking_Connections = () => (
  <Time_Tracking_Shell>{(company) => <Connections_Body company={company} />}</Time_Tracking_Shell>
);

export default Time_Tracking_Connections;

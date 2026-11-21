import { useRef, useState } from 'react';
import { useNavigate } from 'react-router';
import { useTranslation } from 'react-i18next';
import {
  SYNC_INTERVAL_HOURS,
  useBrokerConnections,
  type Broker_Connection,
  type Sync_Interval_Hours,
} from '../../../../Hooks/Finances/usePersonalPortfolio';
import Global_Input from '../../../../Components/Inputs/Global_Input/Global_Input';
import Global_Dropdown from '../../../../Components/Inputs/Global_Dropdown/Global_Dropdown';
import Simple_Button from '../../../../Components/Buttons/Simple_Button/Simple_Button';
import Confirm_Popover from '../../../../Components/Confirm_Popover/Confirm_Popover';
import { localeOf } from '../Earnings/earningsLabels';
import { isFullDate } from '../../../../Hooks/Finances/portfolioInput';
import Broker_Connection_Popover from './Broker_Connection_Popover';
import Platform_Badge from './Platform_Badge';
import '../Earnings/Earnings.scss';
import './Portfolio.scss';

type Editing = { connection: Broker_Connection | null };

/**
 * O dia a partir do qual se vê: escreve-se à vontade (o ano algarismo a algarismo dava
 * datas como 0002-…) e só se grava ao sair do campo ou com Enter, com uma data completa
 * (ou vazio = tudo) e diferente da gravada.
 */
const From_Date_Input = ({ id, value, onCommit }: { id: string; value: string; onCommit: (fromDate: string | null) => void }) => {
  const [draft, setDraft] = useState(value);
  const [saved, setSaved] = useState(value);
  // A data gravada mudou (a resposta do servidor): o campo acompanha-a
  if (saved !== value) {
    setSaved(value);
    setDraft(value);
  }
  // O último enviado: o Enter e depois o sair do campo não gravam duas vezes
  const sent = useRef<string | null>(null);
  const commit = () => {
    if (draft === value || draft === sent.current) return;
    if (draft === '' || isFullDate(draft)) {
      sent.current = draft;
      onCommit(draft || null);
    } else setDraft(value);
  };
  return (
    // O Enter apanha-se à volta (o Global_Input não passa o onKeyDown)
    <div
      onKeyDown={(e) => {
        if (e.key === 'Enter') commit();
      }}
    >
      <Global_Input id={id} type="date" value={draft} onChange={(e) => setDraft(e.target.value)} onBlur={commit} />
    </div>
  );
};

/**
 * As corretoras ligadas pela API (para já a Trading 212, só o dinheiro): o estado,
 * a última sincronização, o dia a partir do qual se vê, de quanto em quanto tempo
 * sincroniza sozinha, os portefólios que criou e as ações — sincronizar agora, pausar,
 * trocar a chave, desligar.
 */
const Portfolio_Connections = () => {
  const { t, i18n } = useTranslation();
  const navigate = useNavigate();
  const locale = localeOf(i18n.language);
  const state = useBrokerConnections();
  const [editing, setEditing] = useState<Editing | null>(null);
  const [deleting, setDeleting] = useState<Broker_Connection | null>(null);

  const close = () => {
    setEditing(null);
    setDeleting(null);
    state.setActionError(null);
  };

  const when = (value: string | null) =>
    value ? new Date(value).toLocaleString(locale, { dateStyle: 'short', timeStyle: 'short' }) : null;

  // A próxima volta automática: a última mais o intervalo (nunca antes de agora)
  const nextSync = (connection: Broker_Connection) => {
    if (!connection.syncedAt || connection.syncing) return null;
    const next = new Date(connection.syncedAt).getTime() + connection.syncEveryHours * 3_600_000;
    return new Date(Math.max(next, Date.now())).toISOString();
  };

  const statusOf = (connection: Broker_Connection) => {
    if (connection.syncing) return { label: t('portfolio.status_syncing'), tone: 'Info' };
    if (connection.status === 'paused') return { label: t('portfolio.status_paused'), tone: '' };
    if (connection.status === 'error') return { label: t('portfolio.status_error'), tone: 'Bad' };
    return { label: t('portfolio.status_active'), tone: 'Ok' };
  };

  return (
    <div className="Earnings">
      {state.error && <span className="Earnings_Message Bad">{state.error}</span>}
      {!editing && state.actionError && <span className="Earnings_Message Bad">{state.actionError}</span>}

      <div className="Card Earnings_Card">
        <div className="Card_Header">
          <div className="Card_Header_Text">
            <span className="Card_Title">{t('portfolio.connectionsTitle')}</span>
            <span className="Card_Subtitle">{t('portfolio.connectionsSubtitle')}</span>
          </div>
          <div className="Earnings_Controls">
            <Simple_Button text={t('portfolio.connectBroker')} onClick={() => setEditing({ connection: null })} />
          </div>
        </div>
        <div className="Earnings_Body">
          {!state.connections ? (
            <span className="Earnings_Message">{t('common.loading')}</span>
          ) : state.connections.length === 0 ? (
            <div className="Empty_State">
              <span className="Empty_State_Title">{t('portfolio.connectionsEmpty')}</span>
              <span className="Empty_State_Text">{t('portfolio.connectionsEmptyHint')}</span>
            </div>
          ) : (
            <div className="Portfolio_Connections">
              {state.connections.map((connection) => {
                const status = statusOf(connection);
                const busy = state.busy === connection.id || connection.syncing;
                const paused = connection.status === 'paused';
                const next = nextSync(connection);
                return (
                  <div key={connection.id} className="Portfolio_Connection">
                    <div className="Portfolio_Connection_Top">
                      <div className="Portfolio_Connection_Who">
                        <Platform_Badge platform={connection.platform} />
                        <div className="Portfolio_Connection_Name">
                          <div className="Portfolio_Connection_Head">
                            <span className="Earnings_Strong">{connection.platform.name}</span>
                            <span className={`Pill ${status.tone}`}>{status.label}</span>
                          </div>
                          <span className="Portfolio_Muted Num">
                            {t('portfolio.accountNumber', { number: connection.externalAccountId })}
                          </span>
                        </div>
                      </div>

                      <div className="Portfolio_Connection_Sync">
                        <div className="Portfolio_Connection_Sync_Text">
                          <span>
                            {connection.syncedAt
                              ? t('portfolio.syncedAt', { when: when(connection.syncedAt) })
                              : t('portfolio.neverSynced')}
                          </span>
                          <span className="Portfolio_Muted">
                            {paused
                              ? t('portfolio.syncAutoPaused')
                              : next
                                ? t('portfolio.nextSync', { when: when(next) })
                                : t(`portfolio.syncEvery_${connection.syncEveryHours}`)}
                          </span>
                        </div>
                        <Simple_Button
                          text={t('portfolio.syncNow')}
                          onClick={() => void state.sync(connection.id)}
                          disabled={busy}
                          auto
                        />
                      </div>
                    </div>

                    {connection.lastError && <span className="Field_Hint Portfolio_Error">{connection.lastError}</span>}

                    <div className="Portfolio_Connection_Portfolios">
                      {connection.portfolios.map((portfolio) => (
                        <button
                          key={portfolio.id}
                          type="button"
                          className="Portfolio_Connection_Chip"
                          onClick={() => navigate(`/Portefolio/p/${portfolio.id}`)}
                        >
                          {portfolio.name}
                        </button>
                      ))}
                    </div>

                    <div className="Portfolio_Connection_Row">
                      <div className="Portfolio_Connection_Settings">
                        <div className="Earnings_Filter">
                          <label className="Eyebrow" htmlFor={`broker-from-${connection.id}`}>{t('portfolio.fromDate')}</label>
                          <From_Date_Input
                            id={`broker-from-${connection.id}`}
                            value={connection.fromDate?.slice(0, 10) ?? ''}
                            onCommit={(fromDate) => void state.update(connection.id, { fromDate })}
                          />
                        </div>
                        <div className="Earnings_Filter">
                          <label className="Eyebrow" htmlFor={`broker-interval-${connection.id}`}>{t('portfolio.syncInterval')}</label>
                          <Global_Dropdown
                            id={`broker-interval-${connection.id}`}
                            value={connection.syncEveryHours}
                            disabled={paused}
                            onChange={(value) =>
                              void state.update(connection.id, { syncEveryHours: Number(value) as Sync_Interval_Hours })
                            }
                            options={SYNC_INTERVAL_HOURS.map((hours) => ({
                              value: hours,
                              label: t(`portfolio.syncInterval_${hours}`),
                            }))}
                          />
                        </div>
                      </div>
                      <div className="Portfolio_Connection_Actions">
                        <Simple_Button
                          text={paused ? t('portfolio.resume') : t('portfolio.pause')}
                          onClick={() => void state.update(connection.id, { paused: !paused })}
                          disabled={state.busy === connection.id}
                          variant="Ghost"
                          small
                          auto
                        />
                        <Simple_Button
                          text={t('portfolio.changeKey')}
                          onClick={() => setEditing({ connection })}
                          variant="Ghost"
                          small
                          auto
                        />
                        <Simple_Button
                          text={t('portfolio.disconnect')}
                          onClick={() => setDeleting(connection)}
                          disabled={busy}
                          variant="Quiet"
                          small
                          auto
                        />
                      </div>
                    </div>
                  </div>
                );
              })}
            </div>
          )}
        </div>
      </div>

      {editing && (
        <Broker_Connection_Popover
          connection={editing.connection}
          saving={state.busy !== null}
          error={state.actionError}
          onClose={close}
          onSave={async (body) => {
            const done = editing.connection ? await state.update(editing.connection.id, body) : await state.connect(body);
            if (done) close();
          }}
        />
      )}

      {deleting && (
        <Confirm_Popover
          title={t('portfolio.disconnectTitle')}
          subtitle={`${deleting.platform.name} · ${deleting.externalAccountId}`}
          message={t('portfolio.disconnectConfirm')}
          confirmText={t('portfolio.disconnect')}
          busy={state.busy === deleting.id}
          onClose={close}
          onConfirm={async () => {
            if (await state.remove(deleting.id)) close();
          }}
        />
      )}
    </div>
  );
};

export default Portfolio_Connections;

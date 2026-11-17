import { useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { useTranslation } from 'react-i18next';
import { useBrokerConnections, type Broker_Connection } from '../../../../Hooks/Finances/usePersonalPortfolio';
import Global_Input from '../../../../Components/Inputs/Global_Input/Global_Input';
import Simple_Button from '../../../../Components/Buttons/Simple_Button/Simple_Button';
import Confirm_Popover from '../../Companies/Company_Members/Confirm_Popover';
import { localeOf } from '../Earnings/earningsLabels';
import Broker_Connection_Popover from './Broker_Connection_Popover';
import Platform_Badge from './Platform_Badge';
import '../Earnings/Earnings.scss';
import './Portfolio.scss';

type Editing = { connection: Broker_Connection | null };

/**
 * As corretoras ligadas pela API (para já a Trading 212, só o dinheiro): o estado,
 * a última sincronização, o dia a partir do qual se vê, os portefólios que criou e
 * as ações — sincronizar agora, pausar, trocar a chave, desligar.
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
            <Simple_Button text={t('portfolio.connectTrading212')} onClick={() => setEditing({ connection: null })} />
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
                return (
                  <div key={connection.id} className="Portfolio_Connection">
                    <div className="Portfolio_Connection_Head">
                      <Platform_Badge platform={connection.platform} />
                      <span className="Earnings_Strong">{connection.platform.name}</span>
                      <span className="Portfolio_Muted Num">
                        {t('portfolio.accountNumber', { number: connection.externalAccountId })}
                      </span>
                      <span className={`Pill ${status.tone}`}>{status.label}</span>
                    </div>

                    <div className="Portfolio_Connection_Facts">
                      <span>
                        {connection.syncedAt
                          ? t('portfolio.syncedAt', { when: when(connection.syncedAt) })
                          : t('portfolio.neverSynced')}
                      </span>
                      <span>{t('portfolio.syncEveryHour')}</span>
                      {connection.portfolios.map((portfolio) => (
                        <button
                          key={portfolio.id}
                          type="button"
                          className="Portfolio_Link"
                          onClick={() => navigate(`/Portefolio/p/${portfolio.id}`)}
                        >
                          {portfolio.name}
                        </button>
                      ))}
                    </div>
                    {connection.lastError && <span className="Field_Hint Portfolio_Error">{connection.lastError}</span>}

                    <div className="Portfolio_Connection_Row">
                      <div className="Earnings_Filter">
                        <span className="Eyebrow">{t('portfolio.fromDate')}</span>
                        <Global_Input
                          id={`broker-from-${connection.id}`}
                          type="date"
                          value={connection.fromDate?.slice(0, 10) ?? ''}
                          disabled={state.busy === connection.id}
                          onChange={(e) => void state.update(connection.id, { fromDate: e.target.value || null })}
                        />
                      </div>
                      <div className="Portfolio_Connection_Actions">
                        <Simple_Button
                          text={connection.syncing ? t('portfolio.syncing') : t('portfolio.syncNow')}
                          onClick={() => void state.sync(connection.id)}
                          disabled={busy}
                          variant="Ghost"
                          auto
                        />
                        <Simple_Button
                          text={connection.status === 'paused' ? t('portfolio.resume') : t('portfolio.pause')}
                          onClick={() => void state.update(connection.id, { paused: connection.status !== 'paused' })}
                          disabled={state.busy === connection.id}
                          variant="Ghost"
                          auto
                        />
                        <Simple_Button
                          text={t('portfolio.changeKey')}
                          onClick={() => setEditing({ connection })}
                          variant="Ghost"
                          auto
                        />
                        <Simple_Button
                          text={t('portfolio.disconnect')}
                          onClick={() => setDeleting(connection)}
                          disabled={busy}
                          variant="Ghost"
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
          saving={state.busy === deleting.id}
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

import { useId, useState } from 'react';
import { useTranslation } from 'react-i18next';
import Simple_Button from '../../../../Components/Buttons/Simple_Button/Simple_Button';
import Global_Input from '../../../../Components/Inputs/Global_Input/Global_Input';
import { getErrorMessage } from '../../../../Hooks/useAsyncRequest';
import { timeTrackingApi, type Time_Organization } from '../../../../Hooks/Companies/useTimeTracking';
import Popover_Shell from '../../../../Components/Popover_Shell/Popover_Shell';

interface Time_Connection_Popover_Props {
  companyId: string;
  onClose: () => void;
  onConnected: () => void;
}

const INTERVALS = [1, 24, 168] as const;

/**
 * Ligar o solidtime em dois passos: o endereço e a chave (validados no solidtime, nada se grava)
 * e depois a organização de onde vêm as horas e de quanto em quanto tempo se sincroniza.
 */
const Time_Connection_Popover = ({ companyId, onClose, onConnected }: Time_Connection_Popover_Props) => {
  const { t } = useTranslation();
  const groupId = useId();
  const [baseUrl, setBaseUrl] = useState('');
  const [token, setToken] = useState('');
  const [organizations, setOrganizations] = useState<Time_Organization[] | null>(null);
  const [account, setAccount] = useState<string | null>(null);
  const [organizationId, setOrganizationId] = useState('');
  const [every, setEvery] = useState<number>(1);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const check = async () => {
    if (!baseUrl.trim() || !token.trim() || busy) return;
    setBusy(true);
    setError(null);
    try {
      const result = await timeTrackingApi.check(companyId, { provider: 'solidtime', baseUrl, token });
      setBaseUrl(result.baseUrl);
      setAccount(result.user.name);
      setOrganizations(result.organizations);
      setOrganizationId(result.organizations[0]?.id ?? '');
    } catch (reason) {
      setError(getErrorMessage(reason));
    } finally {
      setBusy(false);
    }
  };

  const connect = async () => {
    if (!organizationId || busy) return;
    setBusy(true);
    setError(null);
    try {
      await timeTrackingApi.connect(companyId, { provider: 'solidtime', baseUrl, token, organizationId, syncEveryHours: every });
      onConnected();
    } catch (reason) {
      setError(getErrorMessage(reason));
      setBusy(false);
    }
  };

  return (
    <Popover_Shell onClose={onClose} className="Narrow">
      <div className="Popover_Header">
        <div className="Popover_Header_Text">
          <span className="Popover_Title">{t('timeTracking.connectTitle')}</span>
          <span className="Popover_Subtitle">solidtime</span>
        </div>
        <button type="button" className="Popover_Close" onClick={onClose} aria-label={t('common.cancel')}>
          ×
        </button>
      </div>

      <div className="Popover_Body Single_Column">
        {!organizations ? (
          <>
            <div className="Form_Field">
              <label htmlFor="time-connect-url">{t('timeTracking.baseUrl')}</label>
              <Global_Input
                id="time-connect-url"
                value={baseUrl}
                maxLength={300}
                placeholder="https://solidtime.exemplo.pt"
                onChange={(event) => setBaseUrl(event.target.value)}
              />
              <span className="Field_Hint">{t('timeTracking.baseUrlHint')}</span>
            </div>
            <div className="Form_Field">
              <label htmlFor="time-connect-token">{t('timeTracking.token')}</label>
              <Global_Input
                id="time-connect-token"
                type="password"
                value={token}
                maxLength={4000}
                autoComplete="off"
                onChange={(event) => setToken(event.target.value)}
              />
              <span className="Field_Hint">{t('timeTracking.tokenHint')}</span>
            </div>
          </>
        ) : organizations.length === 0 ? (
          <p className="Confirm_Message">{t('timeTracking.noOrganizations')}</p>
        ) : (
          <>
            <span className="Field_Hint">{t('timeTracking.connectedAs', { name: account ?? '' })}</span>
            <div className="Form_Field">
              <label>{t('timeTracking.organization')}</label>
              <div className="Time_Tracking_Options">
                {organizations.map((organization) => (
                  <button
                    key={organization.id}
                    type="button"
                    className={`Time_Tracking_Option${organizationId === organization.id ? ' Active' : ''}`}
                    onClick={() => setOrganizationId(organization.id)}
                  >
                    <span className="Time_Tracking_Strong">{organization.name}</span>
                    <span className="Time_Tracking_Sub">
                      {organization.currency} · {t(`timeTracking.orgRole_${organization.role}`, { defaultValue: organization.role })}
                    </span>
                  </button>
                ))}
              </div>
            </div>
            <div className="Form_Field">
              <label id={`${groupId}-syncEvery`}>{t('timeTracking.syncEvery')}</label>
              <div className="Tabs" role="group" aria-labelledby={`${groupId}-syncEvery`}>
                {INTERVALS.map((hours) => (
                  <button key={hours} type="button" className={every === hours ? 'Active' : ''} aria-pressed={every === hours} onClick={() => setEvery(hours)}>
                    {t(`timeTracking.every_${hours}`)}
                  </button>
                ))}
              </div>
            </div>
          </>
        )}
        {error && <span className="Field_Hint Time_Tracking_Error">{error}</span>}
      </div>

      <div className="Popover_Footer">
        <div className="Form_Action">
          <Simple_Button
            text={organizations ? t('timeTracking.back') : t('common.cancel')}
            onClick={organizations ? () => setOrganizations(null) : onClose}
            variant="Ghost"
          />
        </div>
        <div className="Form_Action">
          {organizations ? (
            <Simple_Button
              text={t('timeTracking.connect')}
              onClick={() => void connect()}
              disabled={busy || !organizationId}
            />
          ) : (
            <Simple_Button
              text={t('timeTracking.check')}
              onClick={() => void check()}
              disabled={busy || !baseUrl.trim() || !token.trim()}
            />
          )}
        </div>
      </div>
    </Popover_Shell>
  );
};

export default Time_Connection_Popover;

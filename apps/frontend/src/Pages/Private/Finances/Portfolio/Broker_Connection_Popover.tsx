import { useState } from 'react';
import { createPortal } from 'react-dom';
import { useTranslation } from 'react-i18next';
import Global_Input from '../../../../Components/Inputs/Global_Input/Global_Input';
import Simple_Button from '../../../../Components/Buttons/Simple_Button/Simple_Button';
import type { Broker_Connection, Broker_Connection_Body } from '../../../../Hooks/Finances/usePersonalPortfolio';
import type { Platform } from '../../../../Hooks/usePlatforms';
import Broker_Picker from './Broker_Picker';
import './Portfolio.scss';
import Popover_Shell from '../../../../Components/Popover_Shell/Popover_Shell';

interface Broker_Connection_Popover_Props {
  // Sem ligação: ligar uma conta nova; com ela: trocar a chave
  connection: Broker_Connection | null;
  saving: boolean;
  error: string | null;
  onClose: () => void;
  onSave: (body: Broker_Connection_Body) => void;
}

/**
 * Ligar uma corretora em dois passos — escolhê-la na lista (`Broker_Picker`) e depois a
 * chave e o segredo da API e, opcional, o dia a partir do qual se vê — ou trocar a chave
 * de uma que já está ligada (só o segundo passo).
 */
const Broker_Connection_Popover = ({ connection, saving, error, onClose, onSave }: Broker_Connection_Popover_Props) => {
  const { t } = useTranslation();
  const [apiKey, setApiKey] = useState('');
  const [apiSecret, setApiSecret] = useState('');
  const [fromDate, setFromDate] = useState('');
  // Ligar: a corretora escolhida no primeiro passo (nula = ainda na lista)
  const [platform, setPlatform] = useState<Platform | null>(null);
  const picking = !connection && !platform;

  const valid = Boolean(apiKey.trim() && apiSecret.trim());

  const submit = (event: React.FormEvent) => {
    event.preventDefault();
    if (!valid || saving) return;
    onSave({
      apiKey: apiKey.trim(),
      apiSecret: apiSecret.trim(),
      ...(connection ? {} : { fromDate: fromDate || null }),
    });
  };

  if (picking)
    return createPortal(
      <Popover_Shell onClose={onClose} className="Narrow">
        <div className="Popover_Header">
          <div className="Popover_Header_Text">
            <span className="Popover_Title">{t('portfolio.connectBroker')}</span>
            <span className="Popover_Subtitle">{t('portfolio.pickBrokerSub')}</span>
          </div>
          <button type="button" className="Popover_Close" onClick={onClose} aria-label={t('common.cancel')}>
            ×
          </button>
        </div>
        <Broker_Picker onPick={setPlatform} />
        <div className="Popover_Footer">
          <div className="Form_Action">
            <Simple_Button text={t('common.cancel')} onClick={onClose} variant="Ghost" />
          </div>
        </div>
      </Popover_Shell>,
      document.body,
    );

  return createPortal(
    <Popover_Shell onClose={onClose} as="form" className="Narrow" onSubmit={submit}>
      <div className="Popover_Header">
        <div className="Popover_Header_Text">
          <span className="Popover_Title">{connection ? t('portfolio.changeKeyTitle') : t('portfolio.connectTitle', { name: platform?.name })}</span>
          <span className="Popover_Subtitle">
            {connection ? t('portfolio.accountNumber', { number: connection.externalAccountId }) : t('portfolio.connectSub')}
          </span>
        </div>
        <button type="button" className="Popover_Close" onClick={onClose} aria-label={t('common.cancel')}>
          ×
        </button>
      </div>
      <div className="Popover_Body Single_Column">
        <div className="Form_Field">
          <label htmlFor="broker-api-key">{t('portfolio.apiKey')} *</label>
          <Global_Input id="broker-api-key" value={apiKey} maxLength={200} autoComplete="off" onChange={(e) => setApiKey(e.target.value)} />
        </div>
        <div className="Form_Field">
          <label htmlFor="broker-api-secret">{t('portfolio.apiSecret')} *</label>
          <Global_Input
            id="broker-api-secret"
            type="password"
            value={apiSecret}
            maxLength={200}
            autoComplete="new-password"
            onChange={(e) => setApiSecret(e.target.value)}
          />
          <span className="Field_Hint">{t('portfolio.keyHint')}</span>
        </div>
        {!connection && (
          <div className="Form_Field">
            <label htmlFor="broker-from-date">{t('portfolio.fromDate')}</label>
            <Global_Input id="broker-from-date" type="date" value={fromDate} onChange={(e) => setFromDate(e.target.value)} />
            <span className="Field_Hint">{t('portfolio.fromDateHint')}</span>
          </div>
        )}
        {error && <span className="Field_Hint Portfolio_Error">{error}</span>}
      </div>
      <div className="Popover_Footer">
        <div className="Form_Action">
          {connection ? (
            <Simple_Button text={t('common.cancel')} onClick={onClose} variant="Ghost" />
          ) : (
            <Simple_Button text={t('common.back')} onClick={() => setPlatform(null)} variant="Ghost" />
          )}
        </div>
        <div className="Form_Action">
          <Simple_Button
            type="submit"
            text={connection ? t('common.save') : t('portfolio.connect')}
            disabled={saving || !valid}
          />
        </div>
      </div>
    </Popover_Shell>,
    document.body,
  );
};

export default Broker_Connection_Popover;

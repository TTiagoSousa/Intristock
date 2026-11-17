import { useEffect, useState } from 'react';
import { createPortal } from 'react-dom';
import { useTranslation } from 'react-i18next';
import Global_Input from '../../../../Components/Inputs/Global_Input/Global_Input';
import Simple_Button from '../../../../Components/Buttons/Simple_Button/Simple_Button';
import type { Broker_Connection, Broker_Connection_Body } from '../../../../Hooks/Finances/usePersonalPortfolio';
import './Portfolio.scss';

interface Broker_Connection_Popover_Props {
  // Sem ligação: ligar uma conta nova; com ela: trocar a chave
  connection: Broker_Connection | null;
  saving: boolean;
  error: string | null;
  onClose: () => void;
  onSave: (body: Broker_Connection_Body) => void;
}

/**
 * Ligar uma conta da Trading 212 (a chave e o segredo da API e, opcional, o dia a
 * partir do qual se vê) ou trocar a chave de uma que já está ligada.
 */
const Broker_Connection_Popover = ({ connection, saving, error, onClose, onSave }: Broker_Connection_Popover_Props) => {
  const { t } = useTranslation();
  const [apiKey, setApiKey] = useState('');
  const [apiSecret, setApiSecret] = useState('');
  const [fromDate, setFromDate] = useState('');

  useEffect(() => {
    const handleEscape = (e: KeyboardEvent) => {
      if (e.key === 'Escape') onClose();
    };
    document.addEventListener('keydown', handleEscape);
    return () => document.removeEventListener('keydown', handleEscape);
  }, [onClose]);

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

  return createPortal(
    <div className="Popover_Backdrop" onClick={onClose}>
      <form className="Popover_Card Narrow" onClick={(e) => e.stopPropagation()} onSubmit={submit}>
        <div className="Popover_Header">
          <div className="Popover_Header_Text">
            <span className="Popover_Title">{connection ? t('portfolio.changeKeyTitle') : t('portfolio.connectTitle')}</span>
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
            <Simple_Button text={t('common.cancel')} onClick={onClose} variant="Ghost" />
          </div>
          <div className="Form_Action">
            <Simple_Button
              type="submit"
              text={saving ? t('portfolio.checkingKey') : connection ? t('common.save') : t('portfolio.connect')}
              disabled={saving || !valid}
            />
          </div>
        </div>
      </form>
    </div>,
    document.body,
  );
};

export default Broker_Connection_Popover;

import { useEffect, useState } from 'react';
import { useTranslation } from 'react-i18next';
import Global_Input from '../../../../Components/Inputs/Global_Input/Global_Input';
import Simple_Button from '../../../../Components/Buttons/Simple_Button/Simple_Button';

interface Delete_Company_Popover_Props {
  companyName: string;
  deleting: boolean;
  onClose: () => void;
  onConfirm: () => void;
}

const Delete_Company_Popover = ({
  companyName,
  deleting,
  onClose,
  onConfirm,
}: Delete_Company_Popover_Props) => {
  const { t } = useTranslation();

  // Escrever o nome à mão. Ao contrário de apagar um pagamento, isto leva a
  // empresa inteira da vista e só o suporte a traz de volta — vale a pena
  // custar mais do que um clique distraído.
  const [typed, setTyped] = useState('');
  const matches = typed.trim() === companyName.trim();

  useEffect(() => {
    const handleEscape = (e: KeyboardEvent) => {
      if (e.key === 'Escape') onClose();
    };

    document.addEventListener('keydown', handleEscape);
    return () => document.removeEventListener('keydown', handleEscape);
  }, [onClose]);

  return (
    <div className="Popover_Backdrop" onClick={onClose}>
      <div className="Popover_Card Narrow" onClick={(e) => e.stopPropagation()}>
        <div className="Popover_Header">
          <div className="Popover_Header_Text">
            <span className="Popover_Title">{t('companySettings.deleteTitle')}</span>
            <span className="Popover_Subtitle">{companyName}</span>
          </div>

          <button
            type="button"
            className="Popover_Close"
            onClick={onClose}
            aria-label={t('common.cancel')}
          >
            ×
          </button>
        </div>

        <div className="Popover_Body">
          <p className="Confirm_Message">{t('companySettings.deleteWarning')}</p>

          <div className="Form_Field">
            <label htmlFor="confirm-name">
              {t('companySettings.deleteTypeName', { name: companyName })}
            </label>
            <Global_Input
              id="confirm-name"
              value={typed}
              onChange={(e) => setTyped(e.target.value)}
              placeholder={companyName}
            />
          </div>
        </div>

        <div className="Popover_Footer">
          <div className="Form_Action">
            <Simple_Button text={t('common.cancel')} onClick={onClose} variant="Ghost" />
          </div>
          <div className="Form_Action">
            <Simple_Button
              text={deleting ? t('common.saving') : t('companySettings.deleteAction')}
              onClick={onConfirm}
              variant="Danger"
              disabled={!matches || deleting}
            />
          </div>
        </div>
      </div>
    </div>
  );
};

export default Delete_Company_Popover;

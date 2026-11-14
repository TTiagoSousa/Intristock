import { useEffect } from 'react';
import { useTranslation } from 'react-i18next';
import Simple_Button from '../../../../Components/Buttons/Simple_Button/Simple_Button';

interface Confirm_Popover_Props {
  title: string;
  subtitle?: string;
  message: string;
  confirmText: string;
  saving: boolean;
  onClose: () => void;
  onConfirm: () => void;
}

/** A pergunta antes de apagar um cargo ou tirar um membro. */
const Confirm_Popover = ({ title, subtitle, message, confirmText, saving, onClose, onConfirm }: Confirm_Popover_Props) => {
  const { t } = useTranslation();

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
            <span className="Popover_Title">{title}</span>
            {subtitle && <span className="Popover_Subtitle">{subtitle}</span>}
          </div>
          <button type="button" className="Popover_Close" onClick={onClose} aria-label={t('common.cancel')}>
            ×
          </button>
        </div>

        <div className="Popover_Body Single_Column">
          <p className="Confirm_Message">{message}</p>
        </div>

        <div className="Popover_Footer">
          <div className="Form_Action">
            <Simple_Button text={t('common.cancel')} onClick={onClose} variant="Ghost" />
          </div>
          <div className="Form_Action">
            <Simple_Button text={saving ? t('common.saving') : confirmText} onClick={onConfirm} disabled={saving} />
          </div>
        </div>
      </div>
    </div>
  );
};

export default Confirm_Popover;

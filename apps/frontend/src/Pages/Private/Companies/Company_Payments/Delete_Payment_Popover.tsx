import { useEffect } from 'react';
import { useTranslation } from 'react-i18next';
import Simple_Button from '../../../../Components/Buttons/Simple_Button/Simple_Button';

interface Delete_Payment_Popover_Props {
  // Já formatado por quem chama, que é quem sabe a moeda e o idioma
  paymentLabel: string;
  onClose: () => void;
  onConfirm: () => void;
}

const Delete_Payment_Popover = ({
  paymentLabel,
  onClose,
  onConfirm,
}: Delete_Payment_Popover_Props) => {
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
            <span className="Popover_Title">{t('payments.deleteTitle')}</span>
            <span className="Popover_Subtitle">{paymentLabel}</span>
          </div>

          <button type="button" className="Popover_Close" onClick={onClose} aria-label={t('common.cancel')}>
            ×
          </button>
        </div>

        <div className="Popover_Body Single_Column">
          <p className="Confirm_Message">{t('payments.deleteConfirm', { payment: paymentLabel })}</p>
        </div>

        <div className="Popover_Footer">
          <div className="Form_Action">
            <Simple_Button text={t('common.cancel')} onClick={onClose} />
          </div>
          <div className="Form_Action">
            <Simple_Button text={t('common.delete')} onClick={onConfirm} />
          </div>
        </div>
      </div>
    </div>
  );
};

export default Delete_Payment_Popover;

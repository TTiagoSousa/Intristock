import { useEffect } from 'react';
import { useTranslation } from 'react-i18next';
import Simple_Button from '../../../../Components/Buttons/Simple_Button/Simple_Button';

interface Delete_Item_Popover_Props {
  itemName: string;
  onClose: () => void;
  onConfirm: () => void;
}

const Delete_Item_Popover = ({ itemName, onClose, onConfirm }: Delete_Item_Popover_Props) => {
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
            <span className="Popover_Title">{t('items.deleteTitle')}</span>
            <span className="Popover_Subtitle">{itemName}</span>
          </div>

          <button type="button" className="Popover_Close" onClick={onClose} aria-label={t('common.cancel')}>
            ×
          </button>
        </div>

        <div className="Popover_Body Single_Column">
          <p className="Confirm_Message">{t('items.deleteConfirm', { name: itemName })}</p>
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

export default Delete_Item_Popover;

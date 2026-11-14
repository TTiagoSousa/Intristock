import { useEffect, useState } from 'react';
import { useTranslation } from 'react-i18next';
import Simple_Button from '../../../../Components/Buttons/Simple_Button/Simple_Button';

interface Delete_Group_Popover_Props {
  groupName: string;
  supplierCount: number;
  onClose: () => void;
  onConfirm: () => Promise<void>;
}

const Delete_Group_Popover = ({
  groupName,
  supplierCount,
  onClose,
  onConfirm,
}: Delete_Group_Popover_Props) => {
  const { t } = useTranslation();
  const [deleting, setDeleting] = useState(false);

  useEffect(() => {
    const handleEscape = (e: KeyboardEvent) => {
      if (e.key === 'Escape') onClose();
    };

    document.addEventListener('keydown', handleEscape);
    return () => document.removeEventListener('keydown', handleEscape);
  }, [onClose]);

  const handleConfirm = async () => {
    setDeleting(true);
    await onConfirm();
    setDeleting(false);
  };

  return (
    <div className="Popover_Backdrop" onClick={onClose}>
      <div className="Popover_Card Narrow" onClick={(e) => e.stopPropagation()}>
        <div className="Popover_Header">
          <div className="Popover_Header_Text">
            <span className="Popover_Title">{t('supplierGroups.deleteTitle')}</span>
            <span className="Popover_Subtitle">{groupName}</span>
          </div>

          <button type="button" className="Popover_Close" onClick={onClose} aria-label={t('common.cancel')}>
            ×
          </button>
        </div>

        <div className="Popover_Body Single_Column">
          <p className="Confirm_Message">{t('supplierGroups.deleteConfirm', { name: groupName })}</p>
          {supplierCount > 0 && (
            <p className="Confirm_Message">
              {t('supplierGroups.deleteKeepsSuppliers', { count: supplierCount })}
            </p>
          )}
        </div>

        <div className="Popover_Footer">
          <div className="Form_Action">
            <Simple_Button text={t('common.cancel')} onClick={onClose} />
          </div>
          <div className="Form_Action">
            <Simple_Button
              text={deleting ? t('common.saving') : t('common.delete')}
              onClick={handleConfirm}
              disabled={deleting}
            />
          </div>
        </div>
      </div>
    </div>
  );
};

export default Delete_Group_Popover;

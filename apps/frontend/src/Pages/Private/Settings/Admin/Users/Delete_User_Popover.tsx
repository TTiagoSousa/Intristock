import { useEffect } from 'react';
import { useTranslation } from 'react-i18next';
import Simple_Button from '../../../../../Components/Buttons/Simple_Button/Simple_Button';
import type { Managed_User } from '../../../../../Hooks/Admin/useUsers';

interface Delete_User_Popover_Props {
  user: Managed_User;
  saving: boolean;
  onClose: () => void;
  onConfirm: () => void;
}

const Delete_User_Popover = ({ user, saving, onClose, onConfirm }: Delete_User_Popover_Props) => {
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
            <span className="Popover_Title">{t('adminUsers.deleteTitle')}</span>
            <span className="Popover_Subtitle">{user.email}</span>
          </div>
          <button type="button" className="Popover_Close" onClick={onClose} aria-label={t('common.cancel')}>
            ×
          </button>
        </div>

        <div className="Popover_Body Single_Column">
          <p className="Confirm_Message">{t('adminUsers.deleteConfirm', { name: user.fullName })}</p>
        </div>

        <div className="Popover_Footer">
          <div className="Form_Action">
            <Simple_Button text={t('common.cancel')} onClick={onClose} variant="Ghost" />
          </div>
          <div className="Form_Action">
            <Simple_Button text={saving ? t('common.saving') : t('common.delete')} onClick={onConfirm} disabled={saving} />
          </div>
        </div>
      </div>
    </div>
  );
};

export default Delete_User_Popover;

import { useTranslation } from 'react-i18next';
import Confirm_Popover from '../../../../../Components/Confirm_Popover/Confirm_Popover';
import type { Managed_User } from '../../../../../Hooks/Admin/useUsers';

interface Delete_User_Popover_Props {
  user: Managed_User;
  saving: boolean;
  onClose: () => void;
  onConfirm: () => void;
}

const Delete_User_Popover = ({ user, saving, onClose, onConfirm }: Delete_User_Popover_Props) => {
  const { t } = useTranslation();

  return (
    <Confirm_Popover
      title={t('adminUsers.deleteTitle')}
      subtitle={user.email}
      message={t('adminUsers.deleteConfirm', { name: user.fullName })}
      confirmText={t('common.delete')}
      busy={saving}
      onClose={onClose}
      onConfirm={onConfirm}
    />
  );
};

export default Delete_User_Popover;

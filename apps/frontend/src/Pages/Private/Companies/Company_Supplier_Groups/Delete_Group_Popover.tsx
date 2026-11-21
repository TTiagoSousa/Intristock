import { useTranslation } from 'react-i18next';
import Confirm_Popover from '../../../../Components/Confirm_Popover/Confirm_Popover';

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

  return (
    <Confirm_Popover
      title={t('supplierGroups.deleteTitle')}
      subtitle={groupName}
      message={t('supplierGroups.deleteConfirm', { name: groupName })}
      confirmText={t('common.delete')}
      onClose={onClose}
      onConfirm={onConfirm}
    >
      {supplierCount > 0 && (
        <p className="Confirm_Message">
          {t('supplierGroups.deleteKeepsSuppliers', { count: supplierCount })}
        </p>
      )}
    </Confirm_Popover>
  );
};

export default Delete_Group_Popover;

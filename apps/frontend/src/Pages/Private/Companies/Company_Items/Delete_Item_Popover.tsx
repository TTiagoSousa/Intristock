import { useTranslation } from 'react-i18next';
import Confirm_Popover from '../../../../Components/Confirm_Popover/Confirm_Popover';

interface Delete_Item_Popover_Props {
  itemName: string;
  onClose: () => void;
  onConfirm: () => void;
}

const Delete_Item_Popover = ({ itemName, onClose, onConfirm }: Delete_Item_Popover_Props) => {
  const { t } = useTranslation();

  return (
    <Confirm_Popover
      title={t('items.deleteTitle')}
      subtitle={itemName}
      message={t('items.deleteConfirm', { name: itemName })}
      confirmText={t('common.delete')}
      onClose={onClose}
      onConfirm={onConfirm}
    />
  );
};

export default Delete_Item_Popover;

import { useTranslation } from 'react-i18next';
import Confirm_Popover from '../../../../Components/Confirm_Popover/Confirm_Popover';

interface Delete_Supplier_Popover_Props {
  supplierName: string;
  onClose: () => void;
  onConfirm: () => void;
}

const Delete_Supplier_Popover = ({
  supplierName,
  onClose,
  onConfirm,
}: Delete_Supplier_Popover_Props) => {
  const { t } = useTranslation();

  return (
    <Confirm_Popover
      title={t('suppliers.deleteTitle')}
      subtitle={supplierName}
      message={t('suppliers.deleteConfirm', { name: supplierName })}
      confirmText={t('common.delete')}
      onClose={onClose}
      onConfirm={onConfirm}
    />
  );
};

export default Delete_Supplier_Popover;

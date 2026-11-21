import { useTranslation } from 'react-i18next';
import Confirm_Popover from '../../../../Components/Confirm_Popover/Confirm_Popover';

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

  return (
    <Confirm_Popover
      title={t('payments.deleteTitle')}
      subtitle={paymentLabel}
      message={t('payments.deleteConfirm', { payment: paymentLabel })}
      confirmText={t('common.delete')}
      onClose={onClose}
      onConfirm={onConfirm}
    />
  );
};

export default Delete_Payment_Popover;

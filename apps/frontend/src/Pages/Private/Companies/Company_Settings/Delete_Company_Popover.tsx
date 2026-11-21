import { useState } from 'react';
import { useTranslation } from 'react-i18next';
import Global_Input from '../../../../Components/Inputs/Global_Input/Global_Input';
import Confirm_Popover from '../../../../Components/Confirm_Popover/Confirm_Popover';

interface Delete_Company_Popover_Props {
  companyName: string;
  deleting: boolean;
  onClose: () => void;
  onConfirm: () => void;
}

const Delete_Company_Popover = ({
  companyName,
  deleting,
  onClose,
  onConfirm,
}: Delete_Company_Popover_Props) => {
  const { t } = useTranslation();

  // Escrever o nome à mão. Ao contrário de apagar um pagamento, isto leva a
  // empresa inteira da vista e só o suporte a traz de volta — vale a pena
  // custar mais do que um clique distraído.
  const [typed, setTyped] = useState('');
  const matches = typed.trim() === companyName.trim();

  return (
    <Confirm_Popover
      title={t('companySettings.deleteTitle')}
      subtitle={companyName}
      message={t('companySettings.deleteWarning')}
      confirmText={t('companySettings.deleteAction')}
      busy={deleting}
      disabled={!matches}
      onClose={onClose}
      onConfirm={onConfirm}
    >
      <div className="Form_Field">
        <label htmlFor="confirm-name">
          {t('companySettings.deleteTypeName', { name: companyName })}
        </label>
        <Global_Input
          id="confirm-name"
          value={typed}
          onChange={(e) => setTyped(e.target.value)}
          placeholder={companyName}
        />
      </div>
    </Confirm_Popover>
  );
};

export default Delete_Company_Popover;

import { useState } from 'react';
import { createPortal } from 'react-dom';
import { useTranslation } from 'react-i18next';
import Confirm_Popover from '../../../../Components/Confirm_Popover/Confirm_Popover';
import { deleteSimulations } from '../../../../Hooks/Trading/useSimulations';

interface Delete_Simulations_Popover_Props {
  ids: string[];
  // O mercado da simulação, quando é só uma
  label?: string;
  onClose: () => void;
  onDeleted: (ids: string[]) => void;
}

/**
 * Pergunta antes de apagar uma ou várias simulações. Se o backend recusar
 * (uma a correr), o motivo fica no popover e nada se apaga. Vai para o
 * `body`, porque também abre do painel lateral, que o prendia lá dentro.
 */
const Delete_Simulations_Popover = ({ ids, label, onClose, onDeleted }: Delete_Simulations_Popover_Props) => {
  const { t } = useTranslation();
  const [error, setError] = useState<string | null>(null);

  const confirm = async () => {
    setError(null);
    const failure = await deleteSimulations(ids);
    if (failure === null) {
      onDeleted(ids);
      return;
    }
    setError(failure || t('trading.runsDeleteError'));
  };

  return createPortal(
    <Confirm_Popover
      title={t('trading.runsDeleteTitle', { count: ids.length })}
      subtitle={label}
      message={t('trading.runsDeleteConfirm', { count: ids.length })}
      error={error}
      confirmText={t('common.delete')}
      onClose={onClose}
      onConfirm={confirm}
    />,
    document.body,
  );
};

export default Delete_Simulations_Popover;

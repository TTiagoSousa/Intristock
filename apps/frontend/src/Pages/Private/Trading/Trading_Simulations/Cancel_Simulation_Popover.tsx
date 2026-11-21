import { useState } from 'react';
import { createPortal } from 'react-dom';
import { useTranslation } from 'react-i18next';
import Confirm_Popover from '../../../../Components/Confirm_Popover/Confirm_Popover';
import { cancelSimulation } from '../../../../Hooks/Trading/useSimulations';

interface Cancel_Simulation_Popover_Props {
  id: string;
  // O mercado da simulação
  label?: string;
  // Na fila cancela-se logo; a correr o simulador ainda a tem de parar
  running: boolean;
  onClose: () => void;
  onCancelled: (id: string) => void;
}

/**
 * Pergunta antes de cancelar uma simulação na fila ou a correr. Se o backend
 * recusar (entretanto acabou), o motivo fica no popover. Vai para o `body`,
 * como o de apagar.
 */
const Cancel_Simulation_Popover = ({ id, label, running, onClose, onCancelled }: Cancel_Simulation_Popover_Props) => {
  const { t } = useTranslation();
  const [error, setError] = useState<string | null>(null);

  const confirm = async () => {
    setError(null);
    const failure = await cancelSimulation(id);
    if (failure === null) {
      onCancelled(id);
      return;
    }
    setError(failure || t('trading.runsCancelError'));
  };

  return createPortal(
    <Confirm_Popover
      title={t('trading.runsCancelTitle')}
      subtitle={label}
      message={t(running ? 'trading.runsCancelConfirmRunning' : 'trading.runsCancelConfirmQueued')}
      error={error}
      confirmText={t('trading.runsCancel')}
      cancelText={t('trading.runsCancelKeep')}
      onClose={onClose}
      onConfirm={confirm}
    />,
    document.body,
  );
};

export default Cancel_Simulation_Popover;

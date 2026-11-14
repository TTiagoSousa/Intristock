import { useEffect, useState } from 'react';
import { createPortal } from 'react-dom';
import { useTranslation } from 'react-i18next';
import Simple_Button from '../../../../Components/Buttons/Simple_Button/Simple_Button';
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
  const [cancelling, setCancelling] = useState(false);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    const handleEscape = (e: KeyboardEvent) => {
      if (e.key === 'Escape') onClose();
    };

    document.addEventListener('keydown', handleEscape);
    return () => document.removeEventListener('keydown', handleEscape);
  }, [onClose]);

  const confirm = async () => {
    setCancelling(true);
    setError(null);
    const failure = await cancelSimulation(id);
    if (failure === null) {
      onCancelled(id);
      return;
    }
    setError(failure || t('trading.runsCancelError'));
    setCancelling(false);
  };

  return createPortal(
    <div className="Popover_Backdrop" onClick={onClose}>
      <div className="Popover_Card Narrow" onClick={(e) => e.stopPropagation()}>
        <div className="Popover_Header">
          <div className="Popover_Header_Text">
            <span className="Popover_Title">{t('trading.runsCancelTitle')}</span>
            {label && <span className="Popover_Subtitle">{label}</span>}
          </div>

          <button type="button" className="Popover_Close" onClick={onClose} aria-label={t('common.close')}>
            ×
          </button>
        </div>

        <div className="Popover_Body Single_Column">
          <p className="Confirm_Message">
            {t(running ? 'trading.runsCancelConfirmRunning' : 'trading.runsCancelConfirmQueued')}
          </p>
          {error && <p className="Confirm_Message Field_Hint_Error">{error}</p>}
        </div>

        <div className="Popover_Footer">
          <div className="Form_Action">
            <Simple_Button text={t('trading.runsCancelKeep')} variant="Ghost" onClick={onClose} />
          </div>
          <div className="Form_Action">
            <Simple_Button text={t('trading.runsCancel')} variant="Danger" disabled={cancelling} onClick={confirm} />
          </div>
        </div>
      </div>
    </div>,
    document.body,
  );
};

export default Cancel_Simulation_Popover;

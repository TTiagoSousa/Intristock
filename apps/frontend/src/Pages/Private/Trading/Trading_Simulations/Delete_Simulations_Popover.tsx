import { useEffect, useState } from 'react';
import { createPortal } from 'react-dom';
import { useTranslation } from 'react-i18next';
import Simple_Button from '../../../../Components/Buttons/Simple_Button/Simple_Button';
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
  const [deleting, setDeleting] = useState(false);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    const handleEscape = (e: KeyboardEvent) => {
      if (e.key === 'Escape') onClose();
    };

    document.addEventListener('keydown', handleEscape);
    return () => document.removeEventListener('keydown', handleEscape);
  }, [onClose]);

  const confirm = async () => {
    setDeleting(true);
    setError(null);
    const failure = await deleteSimulations(ids);
    if (failure === null) {
      onDeleted(ids);
      return;
    }
    setError(failure || t('trading.runsDeleteError'));
    setDeleting(false);
  };

  return createPortal(
    <div className="Popover_Backdrop" onClick={onClose}>
      <div className="Popover_Card Narrow" onClick={(e) => e.stopPropagation()}>
        <div className="Popover_Header">
          <div className="Popover_Header_Text">
            <span className="Popover_Title">{t('trading.runsDeleteTitle', { count: ids.length })}</span>
            {label && <span className="Popover_Subtitle">{label}</span>}
          </div>

          <button type="button" className="Popover_Close" onClick={onClose} aria-label={t('common.cancel')}>
            ×
          </button>
        </div>

        <div className="Popover_Body Single_Column">
          <p className="Confirm_Message">{t('trading.runsDeleteConfirm', { count: ids.length })}</p>
          {error && <p className="Confirm_Message Field_Hint_Error">{error}</p>}
        </div>

        <div className="Popover_Footer">
          <div className="Form_Action">
            <Simple_Button text={t('common.cancel')} variant="Ghost" onClick={onClose} />
          </div>
          <div className="Form_Action">
            <Simple_Button text={t('common.delete')} variant="Danger" disabled={deleting} onClick={confirm} />
          </div>
        </div>
      </div>
    </div>,
    document.body,
  );
};

export default Delete_Simulations_Popover;

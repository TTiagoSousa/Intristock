import { useState } from 'react';
import type { ReactNode } from 'react';
import { useTranslation } from 'react-i18next';
import Simple_Button from '../Buttons/Simple_Button/Simple_Button';
import Popover_Shell from '../Popover_Shell/Popover_Shell';

interface Confirm_Popover_Props {
  title: string;
  subtitle?: string;
  // A pergunta, na caixa vermelha; sem ela só fica o que vier em `children`
  message?: ReactNode;
  // O que vem a mais por baixo da pergunta (um aviso, um campo)
  children?: ReactNode;
  confirmText: string;
  cancelText?: string;
  // A ação a vermelho (apagar, cancelar); falso = o botão normal
  danger?: boolean;
  // A ação está a correr (quem chama sabe) ou não se pode confirmar ainda
  busy?: boolean;
  disabled?: boolean;
  // O motivo de uma recusa, por baixo da pergunta
  error?: string | null;
  onClose: () => void;
  // Uma promessa deixa o botão desligado até acabar
  onConfirm: () => void | Promise<unknown>;
}

/**
 * A pergunta antes de apagar ou cancelar: o título, o que se vai fazer e os
 * dois botões. O botão não troca o texto enquanto corre: fica desligado.
 */
const Confirm_Popover = ({
  title,
  subtitle,
  message,
  children,
  confirmText,
  cancelText,
  danger = true,
  busy = false,
  disabled = false,
  error,
  onClose,
  onConfirm,
}: Confirm_Popover_Props) => {
  const { t } = useTranslation();
  const [running, setRunning] = useState(false);

  const confirm = async () => {
    const result = onConfirm();
    if (!(result instanceof Promise)) return;
    setRunning(true);
    try {
      await result;
    } finally {
      setRunning(false);
    }
  };

  return (
    <Popover_Shell onClose={onClose} className="Narrow">
      <div className="Popover_Header">
        <div className="Popover_Header_Text">
          <span className="Popover_Title">{title}</span>
          {subtitle && <span className="Popover_Subtitle">{subtitle}</span>}
        </div>
        <button type="button" className="Popover_Close" onClick={onClose} aria-label={t('common.close')}>
          ×
        </button>
      </div>

      <div className="Popover_Body Single_Column">
        {message &&
          (typeof message === 'string' ? (
            <p className="Confirm_Message">{message}</p>
          ) : (
            <div className="Confirm_Message">{message}</div>
          ))}
        {children}
        {error && (
          <p className="Confirm_Message Field_Hint_Error" role="alert">
            {error}
          </p>
        )}
      </div>

      <div className="Popover_Footer">
        <div className="Form_Action">
          <Simple_Button text={cancelText ?? t('common.cancel')} onClick={onClose} variant="Ghost" />
        </div>
        <div className="Form_Action">
          <Simple_Button
            text={confirmText}
            onClick={confirm}
            variant={danger ? 'Danger' : 'Primary'}
            disabled={busy || running || disabled}
          />
        </div>
      </div>
    </Popover_Shell>
  );
};

export default Confirm_Popover;

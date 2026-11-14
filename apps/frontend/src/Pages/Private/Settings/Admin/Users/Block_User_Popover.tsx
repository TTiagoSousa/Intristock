import { useEffect, useState } from 'react';
import { useTranslation } from 'react-i18next';
import Global_Input from '../../../../../Components/Inputs/Global_Input/Global_Input';
import Global_Dropdown from '../../../../../Components/Inputs/Global_Dropdown/Global_Dropdown';
import Simple_Button from '../../../../../Components/Buttons/Simple_Button/Simple_Button';
import type { Managed_User } from '../../../../../Hooks/Admin/useUsers';

// As durações prontas, em horas; "custom" escolhe a data
const DURATIONS = ['1', '24', '168', '720', 'custom'] as const;
type Duration = (typeof DURATIONS)[number];

interface Block_User_Popover_Props {
  user: Managed_User;
  saving: boolean;
  onClose: () => void;
  onConfirm: (until: Date, reason: string) => Promise<boolean>;
}

const Block_User_Popover = ({ user, saving, onClose, onConfirm }: Block_User_Popover_Props) => {
  const { t, i18n } = useTranslation();
  const [duration, setDuration] = useState<Duration>('24');
  // "2026-10-27T15:30" no fuso do browser (o que o datetime-local mostra)
  const [customUntil, setCustomUntil] = useState('');
  const [reason, setReason] = useState('');

  useEffect(() => {
    const handleEscape = (e: KeyboardEvent) => {
      if (e.key === 'Escape') onClose();
    };

    document.addEventListener('keydown', handleEscape);
    return () => document.removeEventListener('keydown', handleEscape);
  }, [onClose]);

  // A hora a que se abriu, para o texto de ajuda; ao bloquear conta-se de novo
  const [openedAt] = useState(() => Date.now());
  const untilFrom = (now: number) =>
    duration === 'custom'
      ? customUntil
        ? new Date(customUntil)
        : null
      : new Date(now + Number(duration) * 60 * 60 * 1000);
  const until = untilFrom(openedAt);
  const valid = until !== null && !Number.isNaN(until.getTime()) && until.getTime() > openedAt;

  const handleSubmit = async (event: React.FormEvent) => {
    event.preventDefault();
    const target = untilFrom(Date.now());
    if (!valid || !target) return;
    const saved = await onConfirm(target, reason.trim());
    if (saved) onClose();
  };

  return (
    <div className="Popover_Backdrop" onClick={onClose}>
      <form className="Popover_Card Narrow" onClick={(e) => e.stopPropagation()} onSubmit={handleSubmit}>
        <div className="Popover_Header">
          <div className="Popover_Header_Text">
            <span className="Popover_Title">{t('adminUsers.blockTitle')}</span>
            <span className="Popover_Subtitle">{user.fullName}</span>
          </div>
          <button type="button" className="Popover_Close" onClick={onClose} aria-label={t('common.cancel')}>
            ×
          </button>
        </div>

        <div className="Popover_Body Single_Column">
          <div className="Form_Field">
            <label htmlFor="block-duration">{t('adminUsers.blockDuration')}</label>
            <Global_Dropdown
              id="block-duration"
              value={duration}
              onChange={(value) => setDuration(value as Duration)}
              options={DURATIONS.map((value) => ({ value, label: t(`adminUsers.blockFor_${value}`) }))}
            />
          </div>

          {duration === 'custom' && (
            <div className="Form_Field">
              <label htmlFor="block-until">{t('adminUsers.blockUntil')}</label>
              <Global_Input
                id="block-until"
                type="datetime-local"
                value={customUntil}
                onChange={(e) => setCustomUntil(e.target.value)}
              />
            </div>
          )}

          <div className="Form_Field">
            <label htmlFor="block-reason">{t('adminUsers.blockReason')}</label>
            <Global_Input id="block-reason" value={reason} maxLength={300} onChange={(e) => setReason(e.target.value)} />
            <span className="Field_Hint">
              {valid && until
                ? t('adminUsers.blockHint', {
                    date: until.toLocaleString(i18n.language === 'pt' ? 'pt-PT' : 'en-GB', {
                      dateStyle: 'short',
                      timeStyle: 'short',
                    }),
                  })
                : t('adminUsers.blockPickDate')}
            </span>
          </div>
        </div>

        <div className="Popover_Footer">
          <div className="Form_Action">
            <Simple_Button text={t('common.cancel')} onClick={onClose} variant="Ghost" />
          </div>
          <div className="Form_Action">
            <Simple_Button
              type="submit"
              text={saving ? t('common.saving') : t('adminUsers.block')}
              disabled={saving || !valid}
            />
          </div>
        </div>
      </form>
    </div>
  );
};

export default Block_User_Popover;

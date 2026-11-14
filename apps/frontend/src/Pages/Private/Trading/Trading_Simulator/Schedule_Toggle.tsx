import { useTranslation } from 'react-i18next';
import { Close } from '../../../../Imports/icons';
import type { Schedule_Mode } from '../../../../Hooks/Trading/useSimulation';
import Schedule_Rules from './Schedule_Rules';
import Segmented from './Segmented';
import { newSchedule } from './strategyOptions';
import type { Schedule_Form } from './strategyOptions';

interface Schedule_Toggle_Props {
  schedule: Schedule_Form | null;
  onChange: (schedule: Schedule_Form | null) => void;
  // O texto do botão para ligar ("+ Dias e horas em que entra")
  addLabel: string;
  // Com que modo começa: uma entrada costuma ter dias em que não entra; um stop, dias em que vale
  defaultMode: Schedule_Mode;
}

/**
 * O horário de uma entrada, de um stop ou de uma saída: desligado é só uma
 * ligação ("+ Dias e horas"); ligado, escolhe-se "só nestes" ou "exceto nestes"
 * e as regras. O × volta a desligar (vale sempre).
 */
const Schedule_Toggle = ({ schedule, onChange, addLabel, defaultMode }: Schedule_Toggle_Props) => {
  const { t } = useTranslation();

  if (!schedule) {
    return (
      <button type="button" className="Link_Button Schedule_Add" onClick={() => onChange(newSchedule(defaultMode))}>
        + {addLabel}
      </button>
    );
  }

  return (
    <div className="Schedule_Box">
      <div className="Schedule_Box_Head">
        <span className="Schedule_Box_Title">{addLabel}</span>
        <Segmented
          label={t('trading.scheduleMode')}
          value={schedule.mode}
          options={[
            { value: 'only', label: t('trading.scheduleMode_only') },
            { value: 'except', label: t('trading.scheduleMode_except') },
          ]}
          onChange={(mode) => onChange({ ...schedule, mode })}
        />
        <button
          type="button"
          className="Row_Action"
          onClick={() => onChange(null)}
          aria-label={t('trading.removeSchedule')}
          title={t('trading.removeSchedule')}
        >
          <Close />
        </button>
      </div>
      <Schedule_Rules
        rules={schedule.rules}
        lead={schedule.mode === 'only' ? t('trading.scheduleLead_only') : t('trading.scheduleLead_except')}
        allowEmpty
        onChange={(rules) => onChange(rules.length ? { ...schedule, rules } : null)}
      />
    </div>
  );
};

export default Schedule_Toggle;

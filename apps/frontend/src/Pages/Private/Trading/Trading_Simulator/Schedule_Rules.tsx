import { useTranslation } from 'react-i18next';
import Global_Input from '../../../../Components/Inputs/Global_Input/Global_Input';
import { Plus, Trash } from '../../../../Imports/icons';
import { MAX_SCHEDULE_RULES, WEEKDAYS, newScheduleRule } from './strategyOptions';
import type { Schedule_Rule_Form } from './strategyOptions';

interface Schedule_Rules_Props {
  rules: Schedule_Rule_Form[];
  onChange: (rules: Schedule_Rule_Form[]) => void;
  // A primeira palavra de cada linha ("Não entrar", "Vale")
  lead: string;
  // Com uma regra só, deixa apagá-la (quem a mostra desliga o horário)
  allowEmpty?: boolean;
}

/**
 * As regras de um horário, uma por linha: os dias (nenhum = todos) e as horas
 * (as duas vazias = o dia todo; se o fim for antes do início, passa a
 * meia-noite), no fuso horário da simulação.
 */
const Schedule_Rules = ({ rules, onChange, lead, allowEmpty = false }: Schedule_Rules_Props) => {
  const { t } = useTranslation();

  const update = (id: number, patch: Partial<Schedule_Rule_Form>) =>
    onChange(rules.map((rule) => (rule.id === id ? { ...rule, ...patch } : rule)));

  return (
    <div className="Option_List">
      {rules.map((rule) => (
        <div key={rule.id} className="Option_Sentence">
          <span>{lead}</span>
          <div className="Day_Chips" role="group" aria-label={t('trading.blockDays')}>
            {WEEKDAYS.map((day) => {
              const active = rule.days.includes(day);
              return (
                <button
                  key={day}
                  type="button"
                  className={`Day_Chip${active ? ' Active' : ''}`}
                  aria-pressed={active}
                  onClick={() => update(rule.id, { days: active ? rule.days.filter((item) => item !== day) : [...rule.days, day] })}
                >
                  {t(`trading.weekday_${day}`)}
                </button>
              );
            })}
          </div>
          <span>{t('trading.blockFrom')}</span>
          <Global_Input
            id={`schedule-${rule.id}-from`}
            type="time"
            value={rule.from}
            onChange={(e) => update(rule.id, { from: e.target.value })}
          />
          <span>{t('trading.blockTo')}</span>
          <Global_Input
            id={`schedule-${rule.id}-to`}
            type="time"
            value={rule.to}
            onChange={(e) => update(rule.id, { to: e.target.value })}
          />
          <button
            type="button"
            className="Row_Action Danger"
            onClick={() => onChange(rules.filter((item) => item.id !== rule.id))}
            disabled={!allowEmpty && rules.length <= 1}
            aria-label={t('trading.removeRule')}
            title={t('trading.removeRule')}
          >
            <Trash />
          </button>
        </div>
      ))}
      <button
        type="button"
        className="Add_Condition"
        onClick={() => onChange([...rules, newScheduleRule({ days: [], from: '22:00', to: '06:00' })])}
        disabled={rules.length >= MAX_SCHEDULE_RULES}
      >
        <Plus />
        {t('trading.addBlockedTime')}
      </button>
    </div>
  );
};

export default Schedule_Rules;

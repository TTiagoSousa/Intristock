import { useTranslation } from 'react-i18next';
import Global_Dropdown from '../../../../Components/Inputs/Global_Dropdown/Global_Dropdown';
import Global_Input from '../../../../Components/Inputs/Global_Input/Global_Input';
import { Plus, Trash } from '../../../../Imports/icons';
import type { Duration_Unit, Guard_Event } from '../../../../Hooks/Trading/useSimulation';
import { DURATION_UNITS, GUARD_EVENTS, MAX_GUARDS, guardOk, newGuard } from './strategyOptions';
import type { Guard_Form } from './strategyOptions';

interface Guards_Editor_Props {
  guards: Guard_Form[];
  onChange: (guards: Guard_Form[]) => void;
  quote: string;
}

/**
 * "Não operar se", uma regra por linha, lida como uma frase: "Se houver [3]
 * [stops] em [1] [dias] → parar [1] [dias]". Sem janela conta desde o início;
 * as perdas seguidas não têm janela.
 */
const Guards_Editor = ({ guards, onChange, quote }: Guards_Editor_Props) => {
  const { t } = useTranslation();

  const update = (id: number, patch: Partial<Guard_Form>) =>
    onChange(guards.map((guard) => (guard.id === id ? { ...guard, ...patch } : guard)));

  const unitOptions = DURATION_UNITS.map((unit) => ({ value: unit, label: t(`trading.unit_${unit}`) }));

  return (
    <div className="Option_List">
      {guards.length === 0 && <span className="Simulator_Hint">{t('trading.guardsEmpty')}</span>}

      {guards.map((guard) => (
        <div key={guard.id} className={`Option_Sentence${guardOk(guard) ? '' : ' Invalid'}`}>
          <span>{t('trading.guardIf')}</span>
          <Global_Input
            id={`guard-${guard.id}-value`}
            type="number"
            value={guard.value}
            onChange={(e) => update(guard.id, { value: e.target.value })}
          />
          <div className="Option_Sentence_Select">
            <Global_Dropdown
              id={`guard-${guard.id}-event`}
              value={guard.event}
              searchable={false}
              options={GUARD_EVENTS.map((event) => ({
                value: event,
                label: t(`trading.guard_${event}`, { quote }),
              }))}
              onChange={(event) => update(guard.id, { event: event as Guard_Event })}
            />
          </div>
          {guard.event !== 'lossStreak' && (
            <>
              <span>{t('trading.guardWithin')}</span>
              <Global_Input
                id={`guard-${guard.id}-window`}
                type="number"
                value={guard.windowCount}
                placeholder="∞"
                onChange={(e) => update(guard.id, { windowCount: e.target.value })}
              />
              <div className="Option_Sentence_Unit">
                <Global_Dropdown
                  id={`guard-${guard.id}-window-unit`}
                  value={guard.windowUnit}
                  searchable={false}
                  options={unitOptions}
                  onChange={(unit) => update(guard.id, { windowUnit: unit as Duration_Unit })}
                />
              </div>
            </>
          )}
          <span>→ {t('trading.guardPause')}</span>
          <Global_Input
            id={`guard-${guard.id}-pause`}
            type="number"
            value={guard.pauseCount}
            onChange={(e) => update(guard.id, { pauseCount: e.target.value })}
          />
          <div className="Option_Sentence_Unit">
            <Global_Dropdown
              id={`guard-${guard.id}-pause-unit`}
              value={guard.pauseUnit}
              searchable={false}
              options={unitOptions}
              onChange={(unit) => update(guard.id, { pauseUnit: unit as Duration_Unit })}
            />
          </div>
          <button
            type="button"
            className="Row_Action Danger"
            onClick={() => onChange(guards.filter((item) => item.id !== guard.id))}
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
        onClick={() => onChange([...guards, newGuard()])}
        disabled={guards.length >= MAX_GUARDS}
      >
        <Plus />
        {t('trading.addGuard')}
      </button>
    </div>
  );
};

export default Guards_Editor;

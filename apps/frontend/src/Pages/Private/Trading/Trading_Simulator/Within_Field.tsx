import { useTranslation } from 'react-i18next';
import Global_Dropdown from '../../../../Components/Inputs/Global_Dropdown/Global_Dropdown';
import Global_Input from '../../../../Components/Inputs/Global_Input/Global_Input';
import type { Within_Mode } from '../../../../Hooks/Trading/useSimulation';
import { WITHIN_MODES } from './simulationForm';
import type { Condition_Form } from './simulationForm';

interface Within_Field_Props {
  id: string;
  condition: Condition_Form;
  onChange: (condition: Condition_Form) => void;
}

/**
 * Quando conta uma condição (ou um grupo): agora, nalguma das últimas N velas
 * ("o RSI esteve abaixo de 30 nas últimas 5") ou em todas ("3 fechos seguidos
 * acima da média"). A vela atual conta como uma das N.
 */
const Within_Field = ({ id, condition, onChange }: Within_Field_Props) => {
  const { t } = useTranslation();

  return (
    <div className="Within_Field" title={t('trading.withinHint')}>
      <div className="Mini_Field Within_Mode">
        <label htmlFor={`${id}-within`} className="Hidden_Label">
          {t('trading.within')}
        </label>
        <Global_Dropdown
          id={`${id}-within`}
          value={condition.withinMode || 'now'}
          searchable={false}
          options={[
            { value: 'now', label: t('trading.within_now') },
            ...WITHIN_MODES.map((mode) => ({ value: mode, label: t(`trading.within_${mode}`) })),
          ]}
          onChange={(mode) => onChange({ ...condition, withinMode: mode === 'now' ? '' : (mode as Within_Mode) })}
        />
      </div>
      {condition.withinMode && (
        <div className="Mini_Field Within_Bars">
          <label htmlFor={`${id}-within-bars`} className="Hidden_Label">
            {t('trading.withinBars')}
          </label>
          <Global_Input
            id={`${id}-within-bars`}
            type="number"
            value={condition.withinBars}
            onChange={(e) => onChange({ ...condition, withinBars: e.target.value })}
          />
          <span className="Within_Unit">{t('trading.candlesUnit')}</span>
        </div>
      )}
    </div>
  );
};

export default Within_Field;

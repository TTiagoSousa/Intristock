import { useTranslation } from 'react-i18next';
import Global_Input from '../../../../Components/Inputs/Global_Input/Global_Input';
import { Close } from '../../../../Imports/icons';
import type { Scale_In_Trigger } from '../../../../Hooks/Trading/useSimulation';
import Conditions_Editor from './Conditions_Editor';
import Segmented from './Segmented';
import { MAX_NAME, SCALE_IN_TRIGGERS, TAKE_MODES } from './simulationForm';
import type { Scale_In_Form, Take_Mode } from './simulationForm';

interface Scale_In_Props {
  id: string;
  add: Scale_In_Form;
  position: number;
  onChange: (add: Scale_In_Form) => void;
  onRemove: () => void;
}

/**
 * Um reforço numa frase: "junta X% da posição quando o preço andar N R/% a
 * favor" (ao nível, como uma ordem stop) ou "quando as condições se cumprirem"
 * (na abertura da vela seguinte). Cada um acontece uma vez por posição; o stop
 * e o take profit passam a valer para o conjunto, e o stop pode passar à entrada.
 */
const Scale_In = ({ id, add, position, onChange, onRemove }: Scale_In_Props) => {
  const { t } = useTranslation();
  const set = <K extends keyof Scale_In_Form>(key: K, next: Scale_In_Form[K]) => onChange({ ...add, [key]: next });
  const key = `${id}-scale-in-${add.id}`;

  return (
    <div className="Exit_Tile Rule_Tile partial">
      <div className="Rule_Line">
        <span className="Exit_Tile_Tag">{t('trading.scaleInTitle', { position })}</span>
        <input
          className="Inline_Name"
          value={add.name}
          maxLength={MAX_NAME}
          placeholder={t('trading.namePlaceholder')}
          aria-label={t('trading.name')}
          onChange={(e) => set('name', e.target.value)}
        />
        <span className="Rule_Word">{t('trading.scaleInAdds')}</span>
        <div className="Pct_Field">
          <Global_Input id={`${key}-size`} type="number" value={add.sizePct} onChange={(e) => set('sizePct', e.target.value)} />
          <label htmlFor={`${key}-size`}>%</label>
        </div>
        <span className="Rule_Word">{t('trading.scaleInWhen')}</span>
        <Segmented
          label={t('trading.scaleInWhen')}
          value={add.trigger}
          options={SCALE_IN_TRIGGERS.map((trigger) => ({ value: trigger, label: t(`trading.scaleInTrigger_${trigger}`) }))}
          onChange={(trigger) => set('trigger', trigger as Scale_In_Trigger)}
        />
        {add.trigger === 'profit' && (
          <>
            <div className="Pct_Field">
              <Global_Input
                id={`${key}-profit`}
                type="number"
                value={add.profitValue}
                onChange={(e) => set('profitValue', e.target.value)}
              />
            </div>
            <Segmented
              label={t('trading.partialUnit')}
              value={add.profitMode}
              options={TAKE_MODES.map((mode) => ({ value: mode, label: t(`trading.takeMode_${mode}`) }))}
              onChange={(mode) => set('profitMode', mode as Take_Mode)}
            />
          </>
        )}
        <Segmented
          label={t('trading.partialStop')}
          value={add.moveStop ? 'entry' : 'keep'}
          options={[
            { value: 'keep', label: t('trading.partialStop_keep') },
            { value: 'entry', label: t('trading.partialStop_entry') },
          ]}
          onChange={(choice) => set('moveStop', choice === 'entry')}
        />
        <button
          type="button"
          className="Row_Action Risk_Remove"
          onClick={onRemove}
          title={t('trading.scaleInRemove')}
          aria-label={t('trading.scaleInRemove')}
        >
          <Close />
        </button>
      </div>

      {add.trigger === 'conditions' && (
        <Conditions_Editor
          conditions={add.conditions}
          onChange={(conditions) => set('conditions', conditions)}
          match={add.match}
          onMatchChange={(match) => set('match', match)}
          minimum={1}
          addLabel={t('trading.addCondition')}
        />
      )}
      <span className="Simulator_Hint">
        {t(add.trigger === 'profit' ? `trading.scaleInHint_${add.profitMode}` : 'trading.scaleInHint_conditions', {
          size: add.sizePct || '…',
          value: add.profitValue || '…',
        })}
        {add.moveStop && ` ${t('trading.partialHintMove')}`}
      </span>
    </div>
  );
};

export default Scale_In;

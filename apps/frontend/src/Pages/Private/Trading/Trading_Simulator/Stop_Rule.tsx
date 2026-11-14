import { useTranslation } from 'react-i18next';
import Global_Input from '../../../../Components/Inputs/Global_Input/Global_Input';
import { Close } from '../../../../Imports/icons';
import type { Stop_Rule_Target, Stop_Rule_Trigger } from '../../../../Hooks/Trading/useSimulation';
import Conditions_Editor from './Conditions_Editor';
import Segmented from './Segmented';
import Value_Editor from './Value_Editor';
import { STOP_RULE_TARGETS, STOP_RULE_TRIGGERS, TAKE_MODES } from './simulationForm';
import type { Stop_Rule_Form, Take_Mode } from './simulationForm';

interface Stop_Rule_Props {
  id: string;
  rule: Stop_Rule_Form;
  position: number;
  side: 'long' | 'short';
  onChange: (rule: Stop_Rule_Form) => void;
  onRemove: () => void;
}

/**
 * Um ajuste do stop numa frase: "quando [sempre | o preço andar X R/% a favor |
 * as condições se cumprirem], o stop passa para [a entrada | a mínima de N velas
 * | um nível | um trailing de X %]". Vale da vela seguinte à da entrada em diante
 * e o stop só aperta, nunca alarga.
 */
const Stop_Rule = ({ id, rule, position, side, onChange, onRemove }: Stop_Rule_Props) => {
  const { t } = useTranslation();
  const set = <K extends keyof Stop_Rule_Form>(key: K, next: Stop_Rule_Form[K]) => onChange({ ...rule, [key]: next });
  const key = `${id}-stop-rule-${rule.id}`;
  const buffer = (
    <div className="Pct_Field" title={t('trading.stopBufferHint')}>
      <Global_Input
        id={`${key}-buffer`}
        type="number"
        value={rule.bufferPct}
        placeholder={t('trading.stopBuffer')}
        onChange={(e) => set('bufferPct', e.target.value)}
      />
      <label htmlFor={`${key}-buffer`}>%</label>
    </div>
  );

  return (
    <div className="Exit_Tile Rule_Tile stop_loss">
      <div className="Rule_Line">
        <span className="Exit_Tile_Tag">{t('trading.stopRuleTitle', { position })}</span>
        <span className="Rule_Word">{t('trading.stopRuleWhen')}</span>
        <Segmented
          label={t('trading.stopRuleWhen')}
          value={rule.trigger}
          options={STOP_RULE_TRIGGERS.map((trigger) => ({ value: trigger, label: t(`trading.stopRuleTrigger_${trigger}`) }))}
          onChange={(trigger) => set('trigger', trigger as Stop_Rule_Trigger)}
        />
        {rule.trigger === 'profit' && (
          <>
            <div className="Pct_Field">
              <Global_Input
                id={`${key}-profit`}
                type="number"
                value={rule.profitValue}
                onChange={(e) => set('profitValue', e.target.value)}
              />
            </div>
            <Segmented
              label={t('trading.partialUnit')}
              value={rule.profitMode}
              options={TAKE_MODES.map((mode) => ({ value: mode, label: t(`trading.takeMode_${mode}`) }))}
              onChange={(mode) => set('profitMode', mode as Take_Mode)}
            />
            <span className="Rule_Word">{t('trading.stopRuleInFavour')}</span>
          </>
        )}
        <button
          type="button"
          className="Row_Action Risk_Remove"
          onClick={onRemove}
          title={t('trading.stopRuleRemove')}
          aria-label={t('trading.stopRuleRemove')}
        >
          <Close />
        </button>
      </div>

      {rule.trigger === 'conditions' && (
        <Conditions_Editor
          conditions={rule.conditions}
          onChange={(conditions) => set('conditions', conditions)}
          match={rule.match}
          onMatchChange={(match) => set('match', match)}
          minimum={1}
          addLabel={t('trading.addCondition')}
        />
      )}

      <div className="Rule_Line">
        <span className="Rule_Word">{t('trading.stopRuleTo')}</span>
        <Segmented
          label={t('trading.stopRuleTo')}
          value={rule.to}
          options={STOP_RULE_TARGETS.map((target) => ({
            value: target,
            label: t(`trading.stopRuleTarget_${target}${target === 'swing' ? `_${side}` : ''}`),
          }))}
          onChange={(target) => set('to', target as Stop_Rule_Target)}
        />
        {rule.to === 'swing' && (
          <>
            <div className="Pct_Field">
              <Global_Input id={`${key}-bars`} type="number" value={rule.bars} onChange={(e) => set('bars', e.target.value)} />
              <label htmlFor={`${key}-bars`}>{t('trading.candlesUnit')}</label>
            </div>
            {buffer}
          </>
        )}
        {rule.to === 'level' && (
          <>
            <div className="Operand_Box">
              <Value_Editor
                id={`${key}-level`}
                label={t('trading.stopLevel')}
                priceOnly
                value={rule.level}
                onChange={(level) => set('level', level)}
              />
            </div>
            {buffer}
          </>
        )}
        {rule.to === 'trail' && (
          <div className="Pct_Field">
            <Global_Input id={`${key}-trail`} type="number" value={rule.trailPct} onChange={(e) => set('trailPct', e.target.value)} />
            <label htmlFor={`${key}-trail`}>%</label>
          </div>
        )}
      </div>
      <span className="Simulator_Hint">{t(`trading.stopRuleHint_${rule.to}`)}</span>
    </div>
  );
};

export default Stop_Rule;

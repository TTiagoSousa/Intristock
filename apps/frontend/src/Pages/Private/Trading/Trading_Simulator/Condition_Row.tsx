import { useTranslation } from 'react-i18next';
import Global_Dropdown from '../../../../Components/Inputs/Global_Dropdown/Global_Dropdown';
import Global_Input from '../../../../Components/Inputs/Global_Input/Global_Input';
import { Trash } from '../../../../Imports/icons';
import type { Operator } from '../../../../Hooks/Trading/useSimulation';
import Value_Editor from './Value_Editor';
import Within_Field from './Within_Field';
import { useIndicators } from './indicatorsContext';
import { OPERATORS, isBetween, isNonPriceValue, value } from './simulationForm';
import type { Condition_Form, Value_Form } from './simulationForm';

interface Condition_Row_Props {
  condition: Condition_Form;
  onChange: (condition: Condition_Form) => void;
  onRemove?: () => void;
}

/**
 * Uma condição, como uma frase: [valor] comparação [valor] ± %, ou [valor]
 * entre [valor] e [valor]. A % mexe no lado direito ("fecho acima da MME50 +
 * 1%"); num número não faz sentido. Um RSI (de 0 a 100) compara-se com números
 * ou com outro RSI (o mesmo numa contagem de velas): escolhido à esquerda, um
 * preço à direita passa a número, e o valor fixo aparece primeiro na lista. No fim, quando conta: agora ou nas
 * últimas N velas.
 */
const Condition_Row = ({ condition, onChange, onRemove }: Condition_Row_Props) => {
  const { t } = useTranslation();
  const { indicators } = useIndicators();
  const id = `condition-${condition.id}`;
  const between = isBetween(condition.operator);

  // O RSI, as contagens de velas e o delta e o volume da linha do perfil não são
  // preços: comparam-se com números
  const isOscillator = (item: Value_Form) => isNonPriceValue(item, indicators);
  const oscillator = isOscillator(condition.left);

  const changeLeft = (left: Value_Form) => {
    const priceOnRight = condition.right.kind !== 'number' && !isOscillator(condition.right);
    const right = isOscillator(left) && priceOnRight ? value({ kind: 'number', value: '50' }) : condition.right;
    onChange({ ...condition, left, right });
  };
  const withPct = condition.right.kind !== 'number' || (between && condition.rightTo.kind !== 'number');

  return (
    <div className="Condition_Row">
      <div className="Condition_Sentence">
        <div className="Operand_Box">
          <Value_Editor
            id={`${id}-left`}
            label={t('trading.leftValue')}
            value={condition.left}
            onChange={changeLeft}
          />
        </div>

        <div className="Mini_Field Condition_Operator">
          <label htmlFor={`${id}-operator`} className="Hidden_Label">
            {t('trading.operator')}
          </label>
          <Global_Dropdown
            id={`${id}-operator`}
            value={condition.operator}
            searchable={false}
            maxVisibleOptions={OPERATORS.length}
            options={OPERATORS.map((operator) => ({ value: operator, label: t(`trading.operator_${operator}`) }))}
            onChange={(operator) => onChange({ ...condition, operator: operator as Operator })}
          />
        </div>

        <div className="Operand_Box">
          <Value_Editor
            id={`${id}-right`}
            label={t('trading.rightValue')}
            value={condition.right}
            preferNumber={oscillator}
            onChange={(right) => onChange({ ...condition, right })}
          />
          {between && (
            <>
              <span className="Between_Joiner">{t('trading.betweenAnd')}</span>
              <Value_Editor
                id={`${id}-right-to`}
                label={t('trading.rightToValue')}
                value={condition.rightTo}
                preferNumber={oscillator}
                onChange={(rightTo) => onChange({ ...condition, rightTo })}
              />
            </>
          )}
          {withPct && (
            <div className="Mini_Field Right_Pct" title={t('trading.rightPctHint')}>
              <label htmlFor={`${id}-pct`} className="Hidden_Label">
                {t('trading.rightPct')}
              </label>
              <Global_Input
                id={`${id}-pct`}
                type="number"
                value={condition.rightPct}
                placeholder="± %"
                onChange={(e) => onChange({ ...condition, rightPct: e.target.value })}
              />
            </div>
          )}
        </div>
      </div>

      <Within_Field id={id} condition={condition} onChange={onChange} />

      <button
        type="button"
        className="Row_Action Danger Condition_Remove"
        onClick={onRemove}
        disabled={!onRemove}
        title={t('trading.removeCondition')}
        aria-label={t('trading.removeCondition')}
      >
        <Trash />
      </button>
    </div>
  );
};

export default Condition_Row;

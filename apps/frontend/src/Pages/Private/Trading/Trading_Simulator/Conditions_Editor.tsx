import { Fragment } from 'react';
import { useTranslation } from 'react-i18next';
import { Plus, Trash } from '../../../../Imports/icons';
import Condition_Row from './Condition_Row';
import Within_Field from './Within_Field';
import { useIndicators } from './indicatorsContext';
import { isProfile, isSimulationKind, newCondition, newGroup, newValueAreaCondition } from './simulationForm';
import type { Condition_Form } from './simulationForm';
import type { Condition_Match } from '../../../../Hooks/Trading/useSimulation';

const MAX_CONDITIONS = 10;

interface Conditions_Editor_Props {
  conditions: Condition_Form[];
  onChange: (conditions: Condition_Form[]) => void;
  // Todas (E) ou qualquer uma (OU): troca-se a clicar no "e"/"ou" entre elas
  match: Condition_Match;
  onMatchChange: (match: Condition_Match) => void;
  // As de entrada precisam de pelo menos uma; as de saída podem ficar vazias
  minimum: number;
  addLabel: string;
  emptyText?: string;
  // Dentro de um grupo não há outros grupos
  nested?: boolean;
}

/**
 * Uma lista de condições: todas têm de se cumprir ("e" entre elas) ou basta
 * uma ("ou"). O "e"/"ou" é um botão que troca as duas. Um grupo junta
 * condições entre si e conta como uma só: "A e (B ou C)". Os atalhos da área de
 * valor juntam o fecho dentro dela (entre o VAL e o VAH da sessão anterior) ou
 * fora (acima do VAH ou abaixo do VAL).
 */
const Conditions_Editor = ({
  conditions,
  onChange,
  match,
  onMatchChange,
  minimum,
  addLabel,
  emptyText,
  nested = false,
}: Conditions_Editor_Props) => {
  const { t } = useTranslation();
  const { indicators } = useIndicators();
  // A área de valor do primeiro perfil de volume; só há atalhos com um perfil nos
  // Indicadores — nada se cria sem o utilizador o pôr lá. O perfil saiu das
  // simulações novas (isSimulationKind), por isso o de uma antiga não os mostra
  const profileId = indicators.find((item) => isProfile(item.kind) && isSimulationKind(item.kind))?.id ?? null;
  const addValueArea = (inside: boolean) => {
    if (profileId) onChange([...conditions, newValueAreaCondition(profileId, inside)]);
  };
  const full = conditions.length >= MAX_CONDITIONS;

  const replace = (next: Condition_Form) => onChange(conditions.map((item) => (item.id === next.id ? next : item)));
  const remove = (condition: Condition_Form) =>
    conditions.length > minimum ? () => onChange(conditions.filter((item) => item.id !== condition.id)) : undefined;

  return (
    <>
      {conditions.length === 0 && emptyText ? (
        <span className="Conditions_Empty">{emptyText}</span>
      ) : (
        <div className="Conditions_List">
          {conditions.map((condition, index) => (
            <Fragment key={condition.id}>
              {index > 0 && (
                <button
                  type="button"
                  className={`Flow_Joiner Joiner_Toggle${match === 'any' ? ' Or' : ''}`}
                  onClick={() => onMatchChange(match === 'any' ? 'all' : 'any')}
                  title={t(match === 'any' ? 'trading.matchToAll' : 'trading.matchToAny')}
                >
                  {t(match === 'any' ? 'trading.or' : 'trading.and')}
                </button>
              )}
              {condition.group ? (
                <div className="Condition_Group">
                  <div className="Condition_Group_Head">
                    <span className="Condition_Group_Tag">{t('trading.conditionGroup')}</span>
                    <Within_Field id={`group-${condition.id}`} condition={condition} onChange={replace} />
                    <button
                      type="button"
                      className="Row_Action Danger Condition_Remove"
                      onClick={remove(condition)}
                      disabled={!remove(condition)}
                      title={t('trading.removeGroup')}
                      aria-label={t('trading.removeGroup')}
                    >
                      <Trash />
                    </button>
                  </div>
                  <Conditions_Editor
                    conditions={condition.group}
                    onChange={(group) => replace({ ...condition, group })}
                    match={condition.groupMatch}
                    onMatchChange={(groupMatch) => replace({ ...condition, groupMatch })}
                    minimum={1}
                    addLabel={t('trading.addCondition')}
                    nested
                  />
                </div>
              ) : (
                <Condition_Row condition={condition} onChange={replace} onRemove={remove(condition)} />
              )}
            </Fragment>
          ))}
        </div>
      )}

      <div className="Condition_Adds">
        <button
          type="button"
          className="Add_Condition"
          onClick={() => onChange([...conditions, newCondition(indicators)])}
          disabled={full}
          title={full ? t('trading.maxConditions', { max: MAX_CONDITIONS }) : undefined}
        >
          <Plus />
          {addLabel}
        </button>
        {!nested && (
          <button
            type="button"
            className="Add_Condition"
            onClick={() => onChange([...conditions, newGroup(indicators, match)])}
            disabled={full}
            title={full ? t('trading.maxConditions', { max: MAX_CONDITIONS }) : t('trading.addGroupHint')}
          >
            <Plus />
            {t('trading.addGroup')}
          </button>
        )}
        {!nested &&
          profileId &&
          [true, false].map((inside) => (
            <button
              key={String(inside)}
              type="button"
              className="Add_Condition"
              onClick={() => addValueArea(inside)}
              disabled={full}
              title={full ? t('trading.maxConditions', { max: MAX_CONDITIONS }) : t('trading.addValueAreaHint')}
            >
              <Plus />
              {t(inside ? 'trading.addValueAreaInside' : 'trading.addValueAreaOutside')}
            </button>
          ))}
      </div>
    </>
  );
};

export default Conditions_Editor;

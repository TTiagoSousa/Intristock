import { useTranslation } from 'react-i18next';
import Global_Dropdown from '../../../../Components/Inputs/Global_Dropdown/Global_Dropdown';
import Global_Input from '../../../../Components/Inputs/Global_Input/Global_Input';
import { Close, Plus } from '../../../../Imports/icons';
import type { Context_Kind, Context_Operator, Context_Scope, Trade_Result } from '../../../../Hooks/Trading/useSimulation';
import {
  CONTEXT_KINDS,
  CONTEXT_OPERATORS,
  MAX_CONTEXT_RULES,
  contextCanStick,
  contextHasScope,
  contextIsPct,
  newContext,
} from './simulationForm';
import type { Context_Form } from './simulationForm';

interface Context_Rules_Props {
  id: string;
  rules: Context_Form[];
  onChange: (rules: Context_Form[]) => void;
}

const OPERATOR_SIGNS: Record<Context_Operator, string> = { lt: '<', lte: '≤', eq: '=', gte: '≥', gt: '>' };

/**
 * "Só entra se": condições da conta, todas a cumprir no momento do sinal — o
 * último trade, as séries de perdas ou ganhos, as posições abertas e os trades
 * de hoje (de todas as entradas ou só desta), o P&L de hoje e a queda desde o
 * máximo. Cada uma lê-se como uma frase. As que só mudam com trades fechados
 * (o último trade, as séries, a queda) podem travar de vez: avisa-se.
 */
const Context_Rules = ({ id, rules, onChange }: Context_Rules_Props) => {
  const { t } = useTranslation();
  const replace = (next: Context_Form) => onChange(rules.map((item) => (item.id === next.id ? next : item)));

  return (
    <div className="Exit_Tile Rule_Tile context">
      <div className="Exit_Tile_Header">
        <span className="Exit_Tile_Tag">{t('trading.contextTitle')}</span>
        <span className="Simulator_Hint">{t('trading.contextHint')}</span>
      </div>

      {rules.map((rule) => {
        const key = `${id}-context-${rule.id}`;
        return (
          <div key={rule.id} className="Option_Sentence Context_Sentence">
            <div className="Option_Sentence_Select Context_Kind">
              <Global_Dropdown
                id={`${key}-kind`}
                value={rule.kind}
                searchable={false}
                options={CONTEXT_KINDS.map((kind) => ({ value: kind, label: t(`trading.context_${kind}`) }))}
                onChange={(kind) => replace({ ...rule, kind: kind as Context_Kind })}
              />
            </div>
            {contextHasScope(rule.kind) && (
              <div className="Option_Sentence_Select Context_Scope">
                <Global_Dropdown
                  id={`${key}-scope`}
                  value={rule.scope}
                  searchable={false}
                  options={(['all', 'self'] as Context_Scope[]).map((scope) => ({
                    value: scope,
                    label: t(`trading.contextScope_${scope}`),
                  }))}
                  onChange={(scope) => replace({ ...rule, scope: scope as Context_Scope })}
                />
              </div>
            )}
            {rule.kind === 'lastTrade' ? (
              <div className="Option_Sentence_Select Context_Result">
                <Global_Dropdown
                  id={`${key}-result`}
                  value={rule.result}
                  searchable={false}
                  options={(['loss', 'win'] as Trade_Result[]).map((result) => ({
                    value: result,
                    label: t(`trading.contextResult_${result}`),
                  }))}
                  onChange={(result) => replace({ ...rule, result: result as Trade_Result })}
                />
              </div>
            ) : (
              <>
                <div className="Option_Sentence_Select Context_Operator">
                  <Global_Dropdown
                    id={`${key}-operator`}
                    value={rule.operator}
                    searchable={false}
                    options={CONTEXT_OPERATORS.map((operator) => ({ value: operator, label: OPERATOR_SIGNS[operator] }))}
                    onChange={(operator) => replace({ ...rule, operator: operator as Context_Operator })}
                  />
                </div>
                <label htmlFor={`${key}-value`} className="Hidden_Label">
                  {t('trading.value')}
                </label>
                <Global_Input
                  id={`${key}-value`}
                  type="number"
                  value={rule.value}
                  onChange={(e) => replace({ ...rule, value: e.target.value })}
                />
                {contextIsPct(rule.kind) && <span>%</span>}
              </>
            )}
            <button
              type="button"
              className="Row_Action"
              onClick={() => onChange(rules.filter((item) => item.id !== rule.id))}
              title={t('trading.contextRemove')}
              aria-label={t('trading.contextRemove')}
            >
              <Close />
            </button>
          </div>
        );
      })}

      {rules.some((rule) => contextCanStick(rule.kind)) && (
        <span className="Simulator_Hint Context_Warning">{t('trading.contextStuckHint')}</span>
      )}
      {rules.length < MAX_CONTEXT_RULES && (
        <button type="button" className="Add_Condition" onClick={() => onChange([...rules, newContext()])}>
          <Plus />
          {t('trading.contextAdd')}
        </button>
      )}
    </div>
  );
};

export default Context_Rules;

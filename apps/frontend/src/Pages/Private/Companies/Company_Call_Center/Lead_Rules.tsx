import { useState } from 'react';
import { useTranslation } from 'react-i18next';
import Popover_Shell from '../../../../Components/Popover_Shell/Popover_Shell';
import Simple_Button from '../../../../Components/Buttons/Simple_Button/Simple_Button';
import Global_Input from '../../../../Components/Inputs/Global_Input/Global_Input';
import Global_Dropdown from '../../../../Components/Inputs/Global_Dropdown/Global_Dropdown';
import { getErrorMessage } from '../../../../Hooks/useAsyncRequest';
import type { Data_Row_Filter } from '../../../../Hooks/Companies/useCompanyData';
import {
  leadsApi,
  useLeadRules,
  type Lead_Board,
  type Lead_Condition,
  type Lead_Condition_Field,
  type Lead_Person,
  type Lead_Rule,
  type Lead_Rule_Action,
  type Lead_Source_Column,
  type Lead_Stage,
} from '../../../../Hooks/Companies/useCompanyLeads';
import { Chevron_Down, Edit, Plus, Trash } from '../../../../Imports/icons';
import { Data_Grid_Toolbar } from './Data_Grid_Tools';
import { useFilterDraft } from './useDataGrid';

/** «Estado do envio é um de Delivered» — as condições de uma automação numa frase. */
const useConditionText = (columns: Lead_Source_Column[]) => {
  const { t } = useTranslation();
  const byKey = new Map(columns.map((column) => [column.key, column]));
  return (filter: Data_Row_Filter) => {
    const column = byKey.get(filter.column);
    const value = filter.op === 'in' ? (filter.values ?? []).map((v) => v || t('callCenter.filterValuesEmpty')).join(', ') : (filter.value ?? '');
    return `${column?.label ?? filter.column} ${t(`callCenter.filterOp_${filter.op}`)}${value ? ` ${value}` : ''}`;
  };
};

const CONDITION_OPS: Record<Lead_Condition_Field, string[]> = {
  attempts: ['gte', 'lte', 'eq'],
  daysInStage: ['gte', 'lte', 'eq'],
  assigned: ['empty', 'notEmpty'],
  callbackDue: ['yes', 'no'],
};
const NUMBER_FIELDS: Lead_Condition_Field[] = ['attempts', 'daysInStage'];

/** «Tentativas ≥ 3», «Sem responsável» — uma condição sobre a lead numa frase. */
const useLeadConditionText = () => {
  const { t } = useTranslation();
  return (condition: Lead_Condition) =>
    NUMBER_FIELDS.includes(condition.field)
      ? t(`callCenter.leadsCond_${condition.field}_${condition.op}`, { count: condition.value ?? 0 })
      : t(`callCenter.leadsCond_${condition.field}_${condition.op}`);
};

/** As condições sobre a própria lead: o campo, o operador e (nos números) o valor; uma linha cada. */
const Lead_Conditions_Editor = ({ value, onChange }: { value: Lead_Condition[]; onChange: (next: Lead_Condition[]) => void }) => {
  const { t } = useTranslation();
  const update = (index: number, patch: Partial<Lead_Condition>) =>
    onChange(value.map((condition, i) => (i === index ? { ...condition, ...patch } : condition)));

  return (
    <div className="Leads_Cond_List">
      {value.map((condition, index) => (
        <div key={index} className="Leads_Cond_Row">
          <label className="Leads_Visually_Hidden" htmlFor={`lead-cond-field-${index}`}>{t('callCenter.leadsCondField')}</label>
          <Global_Dropdown
            id={`lead-cond-field-${index}`}
            value={condition.field}
            onChange={(next) => {
              const field = next as Lead_Condition_Field;
              update(index, { field, op: CONDITION_OPS[field][0], value: NUMBER_FIELDS.includes(field) ? (condition.value ?? 1) : undefined });
            }}
            options={(Object.keys(CONDITION_OPS) as Lead_Condition_Field[]).map((field) => ({ value: field, label: t(`callCenter.leadsCondField_${field}`) }))}
          />
          <label className="Leads_Visually_Hidden" htmlFor={`lead-cond-op-${index}`}>{t('callCenter.leadsCondOp')}</label>
          <Global_Dropdown
            id={`lead-cond-op-${index}`}
            value={condition.op}
            onChange={(next) => update(index, { op: String(next) })}
            options={CONDITION_OPS[condition.field].map((op) => ({ value: op, label: t(`callCenter.leadsCondOp_${op}`) }))}
          />
          {NUMBER_FIELDS.includes(condition.field) ? (
            <div className="Leads_Cond_Value">
              <label className="Leads_Visually_Hidden" htmlFor={`lead-cond-value-${index}`}>{t('callCenter.leadsCondValue')}</label>
              <Global_Input
                id={`lead-cond-value-${index}`}
                type="number"
                min={0}
                value={String(condition.value ?? 0)}
                onChange={(event) => update(index, { value: Math.max(0, Math.floor(Number(event.target.value) || 0)) })}
              />
            </div>
          ) : (
            <span />
          )}
          <button
            type="button"
            className="Leads_Comment_Tool"
            aria-label={t('callCenter.leadsCondRemove')}
            title={t('callCenter.leadsCondRemove')}
            onClick={() => onChange(value.filter((_, i) => i !== index))}
          >
            <Trash />
          </button>
        </div>
      ))}
      {value.length < 5 && (
        <div>
          <button type="button" className="Call_Center_Text_Button" onClick={() => onChange([...value, { field: 'attempts', op: 'gte', value: 3 }])}>
            {t('callCenter.leadsCondAdd')}
          </button>
        </div>
      )}
    </div>
  );
};

interface Rule_Form_Props {
  companyId: string;
  board: Lead_Board;
  columns: Lead_Source_Column[];
  stages: Lead_Stage[];
  people: Lead_Person[];
  rule: Lead_Rule | null;
  onDone: () => void;
  onCancel: () => void;
}

/** Uma automação nova ou a editar: o nome, «quando» (as condições, como os filtros), em que colunas, e o que faz. */
const Rule_Form = ({ companyId, board, columns, stages, people, rule, onDone, onCancel }: Rule_Form_Props) => {
  const { t } = useTranslation();
  const grid = useFilterDraft(columns, rule?.conditions ?? []);
  const [name, setName] = useState(rule?.name ?? '');
  const [fromStageIds, setFromStageIds] = useState<string[]>(rule?.fromStageIds ?? []);
  const [action, setAction] = useState<Lead_Rule_Action>(rule?.action ?? 'move');
  const [stageId, setStageId] = useState<string>(rule?.stageId ?? '');
  const [enabled, setEnabled] = useState(rule?.enabled ?? true);
  const [leadConditions, setLeadConditions] = useState<Lead_Condition[]>(rule?.leadConditions ?? []);
  const [assigneeIds, setAssigneeIds] = useState<string[]>(rule?.assigneeIds ?? []);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const source = board.sourceType === 'view' ? `views/${board.viewId}` : `tables/${board.tableId}`;
  const ready =
    Boolean(name.trim()) &&
    grid.filters.length + leadConditions.length > 0 &&
    (action === 'archive' || (action === 'move' && Boolean(stageId)) || (action === 'assign' && assigneeIds.length > 0)) &&
    !saving;
  const toggleAssignee = (id: string) => setAssigneeIds((current) => (current.includes(id) ? current.filter((p) => p !== id) : [...current, id]));

  const toggleStage = (id: string) => setFromStageIds((current) => (current.includes(id) ? current.filter((s) => s !== id) : [...current, id]));

  const save = async () => {
    if (!ready) return;
    setSaving(true);
    setError(null);
    const body = {
      name: name.trim(),
      conditions: grid.filters,
      leadConditions,
      fromStageIds,
      action,
      stageId: action === 'move' ? stageId : null,
      assigneeIds: action === 'assign' ? assigneeIds : [],
      enabled,
    };
    try {
      if (rule) await leadsApi.updateRule(companyId, board.id, rule.id, body);
      else await leadsApi.createRule(companyId, board.id, body);
      onDone();
    } catch (reason) {
      setError(getErrorMessage(reason));
      setSaving(false);
    }
  };

  return (
    <div className="Leads_Rule_Form">
      <div className="Form_Field">
        <label htmlFor="lead-rule-name">{t('callCenter.leadsRuleName')}</label>
        <Global_Input
          id="lead-rule-name"
          value={name}
          maxLength={80}
          autoComplete="off"
          placeholder={t('callCenter.leadsRuleNamePlaceholder')}
          onChange={(event) => setName(event.target.value)}
        />
      </div>

      <div className="Leads_Rule_Step">
        <span className="Leads_Rule_Step_Title">{t('callCenter.leadsRuleWhen')}</span>
        <span className="Field_Hint">{t('callCenter.leadsRuleWhenHint')}</span>
        <Data_Grid_Toolbar grid={grid} showColumns={false} values={{ companyId, source, search: '' }} />
      </div>

      <div className="Leads_Rule_Step">
        <span className="Leads_Rule_Step_Title">{t('callCenter.leadsRuleLead')}</span>
        <span className="Field_Hint">{t('callCenter.leadsRuleLeadHint')}</span>
        <Lead_Conditions_Editor value={leadConditions} onChange={setLeadConditions} />
      </div>

      <fieldset className="Leads_Rule_Step Leads_Rule_Stages">
        <legend className="Leads_Rule_Step_Title">{t('callCenter.leadsRuleFrom')}</legend>
        <span className="Field_Hint">{t('callCenter.leadsRuleFromHint')}</span>
        <div className="Leads_Rule_Stage_List">
          {stages.map((stage) => (
            <label key={stage.id} className="Call_Center_Check">
              <input type="checkbox" checked={fromStageIds.includes(stage.id)} onChange={() => toggleStage(stage.id)} />
              <span>{stage.name}</span>
            </label>
          ))}
        </div>
      </fieldset>

      <div className="Leads_Rule_Step">
        <span className="Leads_Rule_Step_Title">{t('callCenter.leadsRuleThen')}</span>
        <div className="Leads_Settings_Pair">
          <div className="Form_Field">
            <label htmlFor="lead-rule-action">{t('callCenter.leadsRuleAction')}</label>
            <Global_Dropdown
              id="lead-rule-action"
              value={action}
              onChange={(next) => setAction(next as Lead_Rule_Action)}
              options={[
                { value: 'move', label: t('callCenter.leadsRuleAction_move') },
                { value: 'archive', label: t('callCenter.leadsRuleAction_archive') },
                { value: 'assign', label: t('callCenter.leadsRuleAction_assign') },
              ]}
            />
          </div>
          {action === 'move' && (
            <div className="Form_Field">
              <label htmlFor="lead-rule-stage">{t('callCenter.leadsRuleStage')}</label>
              <Global_Dropdown
                id="lead-rule-stage"
                value={stageId}
                placeholder={t('callCenter.leadsRuleStagePlaceholder')}
                onChange={(next) => setStageId(String(next))}
                options={stages.map((stage) => ({ value: stage.id, label: stage.name }))}
              />
            </div>
          )}
        </div>
        {action === 'assign' && (
          <fieldset className="Leads_Rule_Stages">
            <legend className="Field_Hint">{t('callCenter.leadsRuleAssignHint')}</legend>
            <div className="Leads_Rule_Stage_List">
              {people.map((person) => {
                const order = assigneeIds.indexOf(person.id);
                return (
                  <label key={person.id} className="Call_Center_Check">
                    <input type="checkbox" checked={order >= 0} onChange={() => toggleAssignee(person.id)} />
                    <span>
                      {person.name}
                      {order >= 0 && <span className="Leads_Rule_Order"> {order + 1}</span>}
                    </span>
                  </label>
                );
              })}
            </div>
          </fieldset>
        )}
      </div>

      <label className="Call_Center_Check">
        <input type="checkbox" checked={enabled} onChange={(event) => setEnabled(event.target.checked)} />
        <span>{t('callCenter.leadsRuleEnabled')}</span>
      </label>

      <span className="Field_Hint">{t('callCenter.leadsRuleOnceHint')}</span>
      {error && <span className="Call_Center_Message Bad">{error}</span>}

      <div className="Leads_Rule_Form_Actions">
        <Simple_Button text={t('common.cancel')} onClick={onCancel} variant="Ghost" small auto />
        <Simple_Button text={rule ? t('common.save') : t('callCenter.leadsRuleCreate')} onClick={save} disabled={!ready} small auto />
      </div>
    </div>
  );
};

interface Lead_Rules_Props {
  companyId: string;
  board: Lead_Board;
  columns: Lead_Source_Column[];
  stages: Lead_Stage[];
  people: Lead_Person[];
  onChanged: () => void;
  onClose: () => void;
}

/**
 * As automações de uma secção, feitas por quem a gere: cada uma diz quando (as condições sobre os dados da lead e,
 * se se quiser, em que colunas tem de estar) e o que faz (mover para uma coluna ou arquivar). Correm pela ordem da
 * lista, sempre que o quadro se lê; cada uma aplica-se uma vez a cada lead.
 */
const Lead_Rules = ({ companyId, board, columns, stages, people, onChanged, onClose }: Lead_Rules_Props) => {
  const { t } = useTranslation();
  const { data: rules, error, reload } = useLeadRules(companyId, board.id);
  const [editing, setEditing] = useState<Lead_Rule | 'new' | null>(null);
  const [busy, setBusy] = useState(false);
  const [actionError, setActionError] = useState<string | null>(null);
  const [confirming, setConfirming] = useState<string | null>(null);
  const conditionText = useConditionText(columns);
  const leadConditionText = useLeadConditionText();
  const personName = new Map(people.map((person) => [person.id, person.name]));
  const stageName = new Map(stages.map((stage) => [stage.id, stage.name]));

  const run = async (action: () => Promise<unknown>) => {
    setBusy(true);
    setActionError(null);
    try {
      await action();
      reload();
      onChanged();
    } catch (reason) {
      setActionError(getErrorMessage(reason));
    } finally {
      setBusy(false);
    }
  };

  const outcome = (rule: Lead_Rule) =>
    rule.action === 'archive'
      ? t('callCenter.leadsRuleSummaryArchive')
      : rule.action === 'assign'
        ? t('callCenter.leadsRuleSummaryAssign', { people: rule.assigneeIds.map((id) => personName.get(id) ?? '—').join(', ') })
        : rule.stageId
        ? t('callCenter.leadsRuleSummaryMove', { stage: stageName.get(rule.stageId) ?? '—' })
          : t('callCenter.leadsRuleNoStage');

  return (
    <Popover_Shell onClose={onClose} className="Wide" dirty={editing !== null}>
      <div className="Popover_Header">
        <div className="Popover_Header_Text">
          <span className="Popover_Title">{t('callCenter.leadsRulesTitle', { name: board.name })}</span>
          <span className="Popover_Subtitle">{t('callCenter.leadsRulesHint')}</span>
        </div>
        <button type="button" className="Popover_Close" onClick={onClose} aria-label={t('common.cancel')}>
          ×
        </button>
      </div>

      <div className="Popover_Body Single_Column Leads_Rules">
        {editing ? (
          <Rule_Form
            companyId={companyId}
            board={board}
            columns={columns}
            stages={stages}
            people={people}
            rule={editing === 'new' ? null : editing}
            onCancel={() => setEditing(null)}
            onDone={() => {
              setEditing(null);
              reload();
              onChanged();
            }}
          />
        ) : (
          <>
            {error && !rules && <span className="Call_Center_Message Bad">{error}</span>}
            {rules && rules.length === 0 && (
              <div className="Leads_Rules_Empty">
                <span className="Call_Center_Strong">{t('callCenter.leadsRulesEmptyTitle')}</span>
                <span className="Call_Center_Sub">{t('callCenter.leadsRulesEmptyText')}</span>
              </div>
            )}
            {rules && rules.length > 0 && (
              <ol className="Leads_Rules_List">
                {rules.map((rule, index) => (
                  <li key={rule.id} className={`Leads_Rule${rule.enabled ? '' : ' Off'}`}>
                    <label className="Leads_Rule_Toggle" title={t('callCenter.leadsRuleEnabled')}>
                      <input
                        type="checkbox"
                        checked={rule.enabled}
                        disabled={busy}
                        aria-label={t('callCenter.leadsRuleToggle', { name: rule.name })}
                        onChange={(event) => run(() => leadsApi.updateRule(companyId, board.id, rule.id, { enabled: event.target.checked }))}
                      />
                    </label>
                    <div className="Leads_Rule_Text">
                      <span className="Leads_Rule_Name">{rule.name}</span>
                      <span className="Leads_Rule_Summary">
                        <span className="Leads_Rule_Word">{t('callCenter.leadsRuleWhenShort')}</span>{' '}
                        {[...rule.conditions.map(conditionText), ...rule.leadConditions.map(leadConditionText)].join(` ${t('callCenter.leadsRuleAnd')} `)}
                        {rule.fromStageIds.length > 0 && (
                          <> {t('callCenter.leadsRuleInStages', { stages: rule.fromStageIds.map((id) => stageName.get(id) ?? '—').join(', ') })}</>
                        )}
                      </span>
                      <span className="Leads_Rule_Summary">
                        <span className="Leads_Rule_Word">{t('callCenter.leadsRuleThenShort')}</span> {outcome(rule)}
                      </span>
                    </div>
                    <div className="Leads_Rule_Tools">
                      {confirming === rule.id ? (
                        <>
                          <button type="button" className="Call_Center_Text_Button" onClick={() => setConfirming(null)}>
                            {t('common.cancel')}
                          </button>
                          <button
                            type="button"
                            className="Call_Center_Text_Button Leads_Danger"
                            disabled={busy}
                            onClick={() => run(() => leadsApi.deleteRule(companyId, board.id, rule.id)).then(() => setConfirming(null))}
                          >
                            {t('common.delete')}
                          </button>
                        </>
                      ) : (
                        <>
                          <button
                            type="button"
                            className="Leads_Comment_Tool Leads_Rule_Up"
                            disabled={busy || index === 0}
                            aria-label={t('callCenter.leadsRuleUp')}
                            title={t('callCenter.leadsRuleUp')}
                            onClick={() => run(() => leadsApi.updateRule(companyId, board.id, rule.id, { position: index - 1 }))}
                          >
                            <Chevron_Down />
                          </button>
                          <button
                            type="button"
                            className="Leads_Comment_Tool"
                            disabled={busy || index === rules.length - 1}
                            aria-label={t('callCenter.leadsRuleDown')}
                            title={t('callCenter.leadsRuleDown')}
                            onClick={() => run(() => leadsApi.updateRule(companyId, board.id, rule.id, { position: index + 1 }))}
                          >
                            <Chevron_Down />
                          </button>
                          <button type="button" className="Leads_Comment_Tool" aria-label={t('common.edit')} title={t('common.edit')} onClick={() => setEditing(rule)}>
                            <Edit />
                          </button>
                          <button
                            type="button"
                            className="Leads_Comment_Tool"
                            aria-label={t('common.delete')}
                            title={t('common.delete')}
                            onClick={() => setConfirming(rule.id)}
                          >
                            <Trash />
                          </button>
                        </>
                      )}
                    </div>
                  </li>
                ))}
              </ol>
            )}
            {actionError && <span className="Call_Center_Message Bad">{actionError}</span>}
            <div>
              <button type="button" className="Call_Center_Tool" onClick={() => setEditing('new')}>
                <span className="Call_Center_Tool_Icon"><Plus /></span>
                {t('callCenter.leadsRuleNew')}
              </button>
            </div>
          </>
        )}
      </div>
    </Popover_Shell>
  );
};

export default Lead_Rules;

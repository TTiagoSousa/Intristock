import { useState } from 'react';
import { useTranslation } from 'react-i18next';
import Popover_Shell from '../../../../Components/Popover_Shell/Popover_Shell';
import Simple_Button from '../../../../Components/Buttons/Simple_Button/Simple_Button';
import Global_Input from '../../../../Components/Inputs/Global_Input/Global_Input';
import Global_Dropdown from '../../../../Components/Inputs/Global_Dropdown/Global_Dropdown';
import { getErrorMessage } from '../../../../Hooks/useAsyncRequest';
import { useResource } from '../../../../Hooks/Companies/useCompanyData';
import { End_Points } from '../../../../Service/endPoints';
import { leadsApi, type Lead_Board, type Lead_Outcome, type Lead_Outcome_Input, type Lead_Stage } from '../../../../Hooks/Companies/useCompanyLeads';
import { Chevron_Down, Edit, Plus, Trash } from '../../../../Imports/icons';

const NO_STAGE = '__none';

/** Um resultado novo ou a editar: o nome, a coluna para onde a lead vai e o que conta. */
const Outcome_Form = ({
  stages,
  outcome,
  busy,
  onSave,
  onCancel,
}: {
  stages: Lead_Stage[];
  outcome: Lead_Outcome | null;
  busy: boolean;
  onSave: (body: Lead_Outcome_Input & { name: string }) => void;
  onCancel: () => void;
}) => {
  const { t } = useTranslation();
  const [name, setName] = useState(outcome?.name ?? '');
  const [stageId, setStageId] = useState(outcome?.stageId ?? NO_STAGE);
  const [answered, setAnswered] = useState(outcome?.answered ?? false);
  const [countsAsAttempt, setCountsAsAttempt] = useState(outcome?.countsAsAttempt ?? true);
  const [asksCallback, setAsksCallback] = useState(outcome?.asksCallback ?? false);

  return (
    <form
      className="Leads_Rule_Form"
      onSubmit={(event) => {
        event.preventDefault();
        if (!name.trim() || busy) return;
        onSave({ name: name.trim(), stageId: stageId === NO_STAGE ? null : stageId, answered, countsAsAttempt, asksCallback });
      }}
    >
      <div className="Leads_Settings_Pair">
        <div className="Form_Field">
          <label htmlFor="lead-outcome-name">{t('callCenter.leadsOutcomeName')}</label>
          <Global_Input
            id="lead-outcome-name"
            value={name}
            maxLength={40}
            autoComplete="off"
            placeholder={t('callCenter.leadsOutcomeNamePlaceholder')}
            onChange={(event) => setName(event.target.value)}
          />
        </div>
        <div className="Form_Field">
          <label htmlFor="lead-outcome-stage">{t('callCenter.leadsOutcomeStage')}</label>
          <Global_Dropdown
            id="lead-outcome-stage"
            value={stageId}
            onChange={(next) => setStageId(String(next))}
            options={[{ value: NO_STAGE, label: t('callCenter.leadsOutcomeStay') }, ...stages.map((s) => ({ value: s.id, label: s.name }))]}
          />
        </div>
      </div>
      <label className="Call_Center_Check">
        <input type="checkbox" checked={answered} onChange={(event) => setAnswered(event.target.checked)} />
        <span>{t('callCenter.leadsOutcomeAnswered')}</span>
      </label>
      <label className="Call_Center_Check">
        <input type="checkbox" checked={countsAsAttempt} onChange={(event) => setCountsAsAttempt(event.target.checked)} />
        <span>{t('callCenter.leadsOutcomeAttempt')}</span>
      </label>
      <label className="Call_Center_Check">
        <input type="checkbox" checked={asksCallback} onChange={(event) => setAsksCallback(event.target.checked)} />
        <span>{t('callCenter.leadsOutcomeCallback')}</span>
      </label>
      <div className="Leads_Rule_Form_Actions">
        <Simple_Button text={t('common.cancel')} onClick={onCancel} variant="Ghost" small auto />
        <Simple_Button text={outcome ? t('common.save') : t('callCenter.leadsOutcomeCreate')} type="submit" disabled={!name.trim() || busy} small auto />
      </div>
    </form>
  );
};

/**
 * Os botões de resultado de uma secção (os que a gaveta mostra para registar uma chamada): cada um diz para onde vai
 * a lead, se atendeu (a taxa de atendimento), se conta como tentativa e se pede logo a hora de voltar a ligar.
 */
const Lead_Outcomes = ({
  companyId,
  board,
  stages,
  onChanged,
  onClose,
}: {
  companyId: string;
  board: Lead_Board;
  stages: Lead_Stage[];
  onChanged: () => void;
  onClose: () => void;
}) => {
  const { t } = useTranslation();
  const { data: outcomes, error, reload } = useResource<Lead_Outcome[]>(End_Points.Company_Leads_Endpoint(companyId, `boards/${board.id}/outcomes`), {});
  const [editing, setEditing] = useState<Lead_Outcome | 'new' | null>(null);
  const [confirming, setConfirming] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);
  const [actionError, setActionError] = useState<string | null>(null);
  const stageName = new Map(stages.map((s) => [s.id, s.name]));

  const run = async (action: () => Promise<unknown>) => {
    setBusy(true);
    setActionError(null);
    try {
      await action();
      reload();
      onChanged();
      return true;
    } catch (reason) {
      setActionError(getErrorMessage(reason));
      return false;
    } finally {
      setBusy(false);
    }
  };

  return (
    <Popover_Shell onClose={onClose} className="Wide" dirty={editing !== null}>
      <div className="Popover_Header">
        <div className="Popover_Header_Text">
          <span className="Popover_Title">{t('callCenter.leadsOutcomesTitle', { name: board.name })}</span>
          <span className="Popover_Subtitle">{t('callCenter.leadsOutcomesHint')}</span>
        </div>
        <button type="button" className="Popover_Close" onClick={onClose} aria-label={t('common.cancel')}>
          ×
        </button>
      </div>

      <div className="Popover_Body Single_Column Leads_Rules">
        {editing ? (
          <Outcome_Form
            stages={stages}
            outcome={editing === 'new' ? null : editing}
            busy={busy}
            onCancel={() => setEditing(null)}
            onSave={async (body) => {
              const ok = await run(() =>
                editing === 'new' ? leadsApi.createOutcome(companyId, board.id, body) : leadsApi.updateOutcome(companyId, board.id, editing.id, body),
              );
              if (ok) setEditing(null);
            }}
          />
        ) : (
          <>
            {error && !outcomes && <span className="Call_Center_Message Bad">{error}</span>}
            {outcomes && outcomes.length === 0 && <span className="Call_Center_Sub">{t('callCenter.leadsOutcomesEmpty')}</span>}
            {outcomes && outcomes.length > 0 && (
              <ol className="Leads_Rules_List">
                {outcomes.map((outcome, index) => (
                  <li key={outcome.id} className="Leads_Rule">
                    <div className="Leads_Rule_Text">
                      <span className="Leads_Rule_Name">{outcome.name}</span>
                      <span className="Leads_Rule_Summary">
                        {outcome.stageId ? t('callCenter.leadsOutcomeGoesTo', { stage: stageName.get(outcome.stageId) ?? '—' }) : t('callCenter.leadsOutcomeStay')}
                        {outcome.answered && ` · ${t('callCenter.leadsOutcomeAnsweredShort')}`}
                        {!outcome.countsAsAttempt && ` · ${t('callCenter.leadsOutcomeNoAttempt')}`}
                        {outcome.asksCallback && ` · ${t('callCenter.leadsOutcomeCallbackShort')}`}
                      </span>
                    </div>
                    <div className="Leads_Rule_Tools">
                      {confirming === outcome.id ? (
                        <>
                          <button type="button" className="Call_Center_Text_Button" onClick={() => setConfirming(null)}>
                            {t('common.cancel')}
                          </button>
                          <button
                            type="button"
                            className="Call_Center_Text_Button Leads_Danger"
                            disabled={busy}
                            onClick={() => run(() => leadsApi.deleteOutcome(companyId, board.id, outcome.id)).then(() => setConfirming(null))}
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
                            onClick={() => run(() => leadsApi.updateOutcome(companyId, board.id, outcome.id, { position: index - 1 }))}
                          >
                            <Chevron_Down />
                          </button>
                          <button
                            type="button"
                            className="Leads_Comment_Tool"
                            disabled={busy || index === outcomes.length - 1}
                            aria-label={t('callCenter.leadsRuleDown')}
                            title={t('callCenter.leadsRuleDown')}
                            onClick={() => run(() => leadsApi.updateOutcome(companyId, board.id, outcome.id, { position: index + 1 }))}
                          >
                            <Chevron_Down />
                          </button>
                          <button type="button" className="Leads_Comment_Tool" aria-label={t('common.edit')} title={t('common.edit')} onClick={() => setEditing(outcome)}>
                            <Edit />
                          </button>
                          <button type="button" className="Leads_Comment_Tool" aria-label={t('common.delete')} title={t('common.delete')} onClick={() => setConfirming(outcome.id)}>
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
            {(outcomes?.length ?? 0) < 10 && (
              <div>
                <button type="button" className="Call_Center_Tool" onClick={() => setEditing('new')}>
                  <span className="Call_Center_Tool_Icon"><Plus /></span>
                  {t('callCenter.leadsOutcomeNew')}
                </button>
              </div>
            )}
          </>
        )}
      </div>
    </Popover_Shell>
  );
};

export default Lead_Outcomes;

import { useTranslation } from 'react-i18next';
import Global_Input from '../../../../Components/Inputs/Global_Input/Global_Input';
import Global_Dropdown from '../../../../Components/Inputs/Global_Dropdown/Global_Dropdown';
import Simple_Button from '../../../../Components/Buttons/Simple_Button/Simple_Button';
import { DATA_COLUMN_TYPES, type Data_Column_Type } from '../../../../Hooks/Companies/useCompanyData';
import { moveItem } from './dataHelpers';
import { emptyDraft, type Column_Draft } from './columnDrafts';

interface Data_Columns_Editor_Props {
  drafts: Column_Draft[];
  onChange: (drafts: Column_Draft[]) => void;
  keyDraftId: string | null;
  onKeyChange: (draftId: string | null) => void;
  // A chave já não se muda (a tabela tem linhas): o backend recusa
  keyLocked?: boolean;
  // Num ficheiro: a caixa «Entra» e os valores de exemplo; à mão: acrescentar e tirar colunas
  fromFile?: boolean;
  disabled?: boolean;
}

/** As colunas de uma tabela: nome, tipo, se é um dado pessoal, se fica escondida e qual é a chave. */
const Data_Columns_Editor = ({
  drafts,
  onChange,
  keyDraftId,
  onKeyChange,
  keyLocked = false,
  fromFile = false,
  disabled = false,
}: Data_Columns_Editor_Props) => {
  const { t } = useTranslation();

  const update = (draftId: string, patch: Partial<Column_Draft>) =>
    onChange(drafts.map((draft) => (draft.draftId === draftId ? { ...draft, ...patch } : draft)));

  const remove = (draftId: string) => {
    onChange(drafts.filter((draft) => draft.draftId !== draftId));
    if (keyDraftId === draftId) onKeyChange(null);
  };

  const typeOptions = DATA_COLUMN_TYPES.map((type) => ({ value: type, label: t(`callCenter.type_${type}`) }));

  return (
    <div className="Call_Center_Columns">
      {drafts.map((draft, index) => (
        <div key={draft.draftId} className={`Call_Center_Column${draft.keep ? '' : ' Off'}`}>
          {fromFile ? (
            <input
              type="checkbox"
              checked={draft.keep}
              disabled={disabled}
              onChange={(event) => {
                update(draft.draftId, { keep: event.target.checked });
                if (!event.target.checked && keyDraftId === draft.draftId) onKeyChange(null);
              }}
              aria-label={t('callCenter.columnKeep', { name: draft.sourceHeader ?? draft.label })}
            />
          ) : (
            <span className="Call_Center_Sub">{index + 1}</span>
          )}
          <Global_Input
            id={`data-column-label-${draft.draftId}`}
            value={draft.label}
            placeholder={t('callCenter.columnLabel')}
            disabled={disabled || !draft.keep}
            onChange={(event) => update(draft.draftId, { label: event.target.value })}
          />
          <Global_Dropdown
            id={`data-column-type-${draft.draftId}`}
            value={draft.type}
            disabled={disabled || !draft.keep}
            onChange={(value) => update(draft.draftId, { type: value as Data_Column_Type })}
            options={typeOptions}
          />
          <label className="Call_Center_Check">
            <input
              type="checkbox"
              checked={draft.personal}
              disabled={disabled || !draft.keep}
              onChange={(event) => update(draft.draftId, { personal: event.target.checked })}
            />
            {t('callCenter.columnPersonal')}
          </label>
          <label className="Call_Center_Check">
            <input
              type="checkbox"
              checked={draft.hidden}
              disabled={disabled || !draft.keep}
              onChange={(event) => update(draft.draftId, { hidden: event.target.checked })}
            />
            {t('callCenter.columnHidden')}
          </label>
          <label className="Call_Center_Check">
            <input
              type="radio"
              name="data-key-column"
              checked={keyDraftId === draft.draftId}
              disabled={disabled || keyLocked || !draft.keep}
              onChange={() => onKeyChange(draft.draftId)}
            />
            {t('callCenter.columnKey')}
          </label>
          {fromFile ? (
            <span />
          ) : (
            <div className="Call_Center_Row_Actions">
              <button
                type="button"
                className="Call_Center_Action"
                disabled={disabled || index === 0}
                onClick={() => onChange(moveItem(drafts, index, -1))}
                aria-label={t('callCenter.moveUp')}
              >
                ↑
              </button>
              <button
                type="button"
                className="Call_Center_Action"
                disabled={disabled || index === drafts.length - 1}
                onClick={() => onChange(moveItem(drafts, index, 1))}
                aria-label={t('callCenter.moveDown')}
              >
                ↓
              </button>
              <button
                type="button"
                className="Call_Center_Action Danger"
                disabled={disabled || (keyLocked && keyDraftId === draft.draftId)}
                onClick={() => remove(draft.draftId)}
              >
                {t('callCenter.columnRemove')}
              </button>
            </div>
          )}
          {(draft.sourceHeader || draft.samples?.length) && (
            <span className="Call_Center_Column_Meta">
              {draft.sourceHeader && t('callCenter.columnFromHeader', { header: draft.sourceHeader })}
              {draft.samples?.length ? ` — ${t('callCenter.columnSamples', { values: draft.samples.slice(0, 3).join(' | ') })}` : ''}
            </span>
          )}
        </div>
      ))}

      <div className="Call_Center_Head_Actions">
        {!fromFile && (
          <Simple_Button
            text={t('callCenter.columnAdd')}
            onClick={() => onChange([...drafts, emptyDraft()])}
            disabled={disabled}
            variant="Ghost"
            small
            auto
          />
        )}
        {keyDraftId && !keyLocked && (
          <Simple_Button text={t('callCenter.keyClear')} onClick={() => onKeyChange(null)} disabled={disabled} variant="Quiet" small auto />
        )}
      </div>
      <span className="Field_Hint">{keyLocked ? t('callCenter.keyLockedHint') : t('callCenter.keyHint')}</span>
    </div>
  );
};

export default Data_Columns_Editor;

import { useState } from 'react';
import { useTranslation } from 'react-i18next';
import Popover_Shell from '../../../../Components/Popover_Shell/Popover_Shell';
import Simple_Button from '../../../../Components/Buttons/Simple_Button/Simple_Button';
import Global_Input from '../../../../Components/Inputs/Global_Input/Global_Input';
import { MASKED, type Data_Column, type Data_Row, type Data_Value } from '../../../../Hooks/Companies/useCompanyData';

interface Data_Row_Popover_Props {
  columns: Data_Column[];
  keyColumn: string | null;
  // Sem ela, uma linha nova
  row: Data_Row | null;
  // Os dados pessoais vêm escondidos: não se editam (iam gravar-se os pontos)
  personalVisible: boolean;
  saving: boolean;
  error: string | null;
  onClose: () => void;
  onSave: (data: Record<string, Data_Value>) => void;
}

const INPUT_TYPES: Record<string, string> = { number: 'text', money: 'text', date: 'date', email: 'email', phone: 'tel', text: 'text' };

const toText = (value: Data_Value | undefined) => (value === null || value === undefined ? '' : String(value));

/** Uma linha escrita à mão (ou corrigida): um campo por coluna. O backend lê os números e as datas. */
const Data_Row_Popover = ({ columns, keyColumn, row, personalVisible, saving, error, onClose, onSave }: Data_Row_Popover_Props) => {
  const { t } = useTranslation();
  const [values, setValues] = useState<Record<string, string>>(() =>
    Object.fromEntries(columns.map((column) => [column.key, toText(row?.data[column.key])])),
  );

  const locked = (column: Data_Column) => column.personal && !personalVisible;
  const keyOf = columns.find((column) => column.key === keyColumn);
  const missingKey = !!keyOf && !locked(keyOf) && !values[keyOf.key]?.trim();

  const submit = () => {
    if (saving || missingKey) return;
    // Só vão os campos que se podem editar; um vazio grava-se vazio
    const data: Record<string, Data_Value> = {};
    for (const column of columns) {
      if (locked(column)) continue;
      const text = values[column.key]?.trim() ?? '';
      if (row && text === toText(row.data[column.key])) continue;
      data[column.key] = text === '' ? null : text;
    }
    onSave(data);
  };

  return (
    <Popover_Shell onClose={onClose} className="Narrow" as="form" onSubmit={(event) => { event.preventDefault(); submit(); }}>
      <div className="Popover_Header">
        <div className="Popover_Header_Text">
          <span className="Popover_Title">{row ? t('callCenter.rowEdit') : t('callCenter.rowAdd')}</span>
        </div>
        <button type="button" className="Popover_Close" onClick={onClose} aria-label={t('common.cancel')}>
          ×
        </button>
      </div>

      <div className="Popover_Body Single_Column">
        {columns.map((column) => (
          <div key={column.key} className="Form_Field">
            <label htmlFor={`data-row-${column.key}`}>
              {column.label}
              {column.key === keyColumn ? ` (${t('callCenter.columnKey').toLowerCase()})` : ''}
            </label>
            <Global_Input
              id={`data-row-${column.key}`}
              type={INPUT_TYPES[column.type] ?? 'text'}
              value={locked(column) ? MASKED : (values[column.key] ?? '')}
              disabled={locked(column) || saving}
              onChange={(event) => setValues((current) => ({ ...current, [column.key]: event.target.value }))}
            />
          </div>
        ))}
        {missingKey && <span className="Field_Hint">{t('callCenter.rowNeedsKey')}</span>}
        {error && <span className="Call_Center_Message Bad">{error}</span>}
      </div>

      <div className="Popover_Footer">
        <div className="Form_Action">
          <Simple_Button text={t('common.cancel')} onClick={onClose} variant="Ghost" />
        </div>
        <div className="Form_Action">
          <Simple_Button text={t('common.save')} type="submit" disabled={saving || missingKey} />
        </div>
      </div>
    </Popover_Shell>
  );
};

export default Data_Row_Popover;

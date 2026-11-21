import { useState } from 'react';
import { useTranslation } from 'react-i18next';
import Global_Input from '../../../../Components/Inputs/Global_Input/Global_Input';
import Global_Dropdown from '../../../../Components/Inputs/Global_Dropdown/Global_Dropdown';
import Simple_Button from '../../../../Components/Buttons/Simple_Button/Simple_Button';
import type {
  Member_Contract,
  Member_Contract_Input,
  Member_Contract_Type,
} from '../../../../Hooks/Companies/useCompanyMember';
import { localToday } from '../../../../utils/dates';
import Popover_Shell from '../../../../Components/Popover_Shell/Popover_Shell';

const CONTRACT_TYPES: Member_Contract_Type[] = ['permanent', 'fixed_term', 'services', 'internship', 'other'];

interface Member_Contract_Popover_Props {
  contract: Member_Contract | null;
  saving: boolean;
  onClose: () => void;
  onSave: (input: Member_Contract_Input) => void;
}

/** Um contrato: o tipo, um título, o início e o fim e notas. Os ficheiros carregam-se na lista. */
const Member_Contract_Popover = ({ contract, saving, onClose, onSave }: Member_Contract_Popover_Props) => {
  const { t } = useTranslation();
  const [type, setType] = useState<Member_Contract_Type>(contract?.type ?? 'permanent');
  const [title, setTitle] = useState(contract?.title ?? '');
  const [startDate, setStartDate] = useState(contract?.startDate.slice(0, 10) ?? localToday());
  const [endDate, setEndDate] = useState(contract?.endDate?.slice(0, 10) ?? '');
  const [notes, setNotes] = useState(contract?.notes ?? '');

  const submit = (event: React.FormEvent) => {
    event.preventDefault();
    if (!startDate) return;
    onSave({ type, title: title.trim() || null, startDate, endDate: endDate || null, notes: notes.trim() || null });
  };

  return (
    <Popover_Shell onClose={onClose} as="form" className="Narrow" onSubmit={submit}>
      <div className="Popover_Header">
        <div className="Popover_Header_Text">
          <span className="Popover_Title">
            {t(contract ? 'memberContracts.editTitle' : 'memberContracts.addTitle')}
          </span>
        </div>
        <button type="button" className="Popover_Close" onClick={onClose} aria-label={t('common.cancel')}>
          ×
        </button>
      </div>

      <div className="Popover_Body Single_Column">
        <div className="Form_Field">
          <label htmlFor="contract-type">{t('memberContracts.type')} *</label>
          <Global_Dropdown
            id="contract-type"
            value={type}
            onChange={(value) => setType(value as Member_Contract_Type)}
            options={CONTRACT_TYPES.map((option) => ({ value: option, label: t(`memberContracts.type_${option}`) }))}
          />
        </div>
        <div className="Form_Field">
          <label htmlFor="contract-title">{t('memberContracts.title')}</label>
          <Global_Input id="contract-title" value={title} onChange={(e) => setTitle(e.target.value)} />
        </div>
        <div className="Form_Field">
          <label htmlFor="contract-start">{t('memberContracts.startDate')} *</label>
          <Global_Input id="contract-start" type="date" value={startDate} onChange={(e) => setStartDate(e.target.value)} />
        </div>
        <div className="Form_Field">
          <label htmlFor="contract-end">{t('memberContracts.endDate')}</label>
          <Global_Input id="contract-end" type="date" value={endDate} onChange={(e) => setEndDate(e.target.value)} />
          <span className="Field_Hint">{t('memberContracts.endDateHint')}</span>
        </div>
        <div className="Form_Field">
          <label htmlFor="contract-notes">{t('memberContracts.notes')}</label>
          <textarea
            id="contract-notes"
            className="Form_Textarea"
            rows={3}
            value={notes}
            onChange={(e) => setNotes(e.target.value)}
          />
        </div>
      </div>

      <div className="Popover_Footer">
        <div className="Form_Action">
          <Simple_Button text={t('common.cancel')} onClick={onClose} variant="Ghost" />
        </div>
        <div className="Form_Action">
          <Simple_Button
            type="submit"
            text={t('common.save')}
            disabled={saving || !startDate}
          />
        </div>
      </div>
    </Popover_Shell>
  );
};

export default Member_Contract_Popover;

import { useEffect, useState } from 'react';
import { useTranslation } from 'react-i18next';
import { useAlert } from '../../../../Contexts/Alert_Context';
import type { CompanySupplierGroup } from '../../../../Hooks/Companies/useCompanySupplierGroups';
import Global_Input from '../../../../Components/Inputs/Global_Input/Global_Input';
import Simple_Button from '../../../../Components/Buttons/Simple_Button/Simple_Button';

interface Supplier_Group_Form_Popover_Props {
  companyName: string;
  // Quando vem preenchido, o formulário está em modo de edição
  group?: CompanySupplierGroup;
  // Quando é aberto por cima de outro popover (ex. a partir da form do fornecedor)
  stacked?: boolean;
  onClose: () => void;
  onSubmit: (payload: { name: string; description?: string }) => Promise<void>;
}

const Supplier_Group_Form_Popover = ({
  companyName,
  group,
  stacked,
  onClose,
  onSubmit,
}: Supplier_Group_Form_Popover_Props) => {
  const { t } = useTranslation();
  const { setAlert } = useAlert();

  const [name, setName] = useState(group?.name ?? '');
  const [description, setDescription] = useState(group?.description ?? '');
  const [saving, setSaving] = useState(false);

  useEffect(() => {
    const handleEscape = (e: KeyboardEvent) => {
      if (e.key === 'Escape') onClose();
    };

    document.addEventListener('keydown', handleEscape);
    return () => document.removeEventListener('keydown', handleEscape);
  }, [onClose]);

  const handleSubmit = async (event: React.FormEvent) => {
    event.preventDefault();

    if (name.trim().length < 2) {
      setAlert({ open: true, message: t('supplierGroups.nameTooShort'), type: 'error' });
      return;
    }

    setSaving(true);
    await onSubmit({ name: name.trim(), description: description.trim() || undefined });
    setSaving(false);
  };

  return (
    <div className={`Popover_Backdrop${stacked ? ' Stacked' : ''}`} onClick={onClose}>
      <form
        className="Popover_Card Narrow"
        onClick={(e) => e.stopPropagation()}
        onSubmit={handleSubmit}
      >
        <div className="Popover_Header">
          <div className="Popover_Header_Text">
            <span className="Popover_Title">
              {t(group ? 'supplierGroups.editTitle' : 'supplierGroups.createTitle')}
            </span>
            <span className="Popover_Subtitle">{companyName}</span>
          </div>

          <button type="button" className="Popover_Close" onClick={onClose} aria-label={t('common.cancel')}>
            ×
          </button>
        </div>

        <div className="Popover_Body Single_Column">
          <div className="Form_Field">
            <label htmlFor="group-name">{t('supplierGroups.columnName')} *</label>
            <Global_Input
              id="group-name"
              value={name}
              onChange={(e) => setName(e.target.value)}
              placeholder={t('supplierGroups.namePlaceholder')}
            />
          </div>

          <div className="Form_Field">
            <label htmlFor="group-description">{t('supplierGroups.columnDescription')}</label>
            <textarea
              id="group-description"
              className="Form_Textarea"
              value={description}
              onChange={(e) => setDescription(e.target.value)}
              placeholder={t('supplierGroups.descriptionPlaceholder')}
              rows={3}
            />
          </div>
        </div>

        <div className="Popover_Footer">
          <div className="Form_Action">
            <Simple_Button text={t('common.cancel')} onClick={onClose} />
          </div>
          <div className="Form_Action">
            <Simple_Button
              type="submit"
              text={saving ? t('common.saving') : t('common.save')}
              disabled={saving}
            />
          </div>
        </div>
      </form>
    </div>
  );
};

export default Supplier_Group_Form_Popover;

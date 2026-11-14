import { useEffect, useState } from 'react';
import { useTranslation } from 'react-i18next';
import Global_Input from '../../../../Components/Inputs/Global_Input/Global_Input';
import Simple_Button from '../../../../Components/Buttons/Simple_Button/Simple_Button';
import type { Company_Role, Role_Input } from '../../../../Hooks/Companies/useCompanyAccessAdmin';
import type { CompanyPermission, CompanyPermissionArea } from '../../../../Hooks/Companies/companyPermissions';
import Permission_Grid from './Permission_Grid';

interface Role_Popover_Props {
  catalog: CompanyPermissionArea[];
  // Sem cargo é um novo
  role: Company_Role | null;
  saving: boolean;
  readOnly: boolean;
  onClose: () => void;
  onSave: (input: Role_Input) => void;
}

/** Criar ou editar um cargo: o nome, a descrição e a grelha das permissões. */
const Role_Popover = ({ catalog, role, saving, readOnly, onClose, onSave }: Role_Popover_Props) => {
  const { t } = useTranslation();
  const [name, setName] = useState(role?.name ?? '');
  const [description, setDescription] = useState(role?.description ?? '');
  const [permissions, setPermissions] = useState<CompanyPermission[]>(role?.permissions ?? []);

  useEffect(() => {
    const handleEscape = (e: KeyboardEvent) => {
      if (e.key === 'Escape') onClose();
    };
    document.addEventListener('keydown', handleEscape);
    return () => document.removeEventListener('keydown', handleEscape);
  }, [onClose]);

  const submit = (event: React.FormEvent) => {
    event.preventDefault();
    if (!readOnly && name.trim()) onSave({ name: name.trim(), description: description.trim(), permissions });
  };

  return (
    <div className="Popover_Backdrop" onClick={onClose}>
      <form className="Popover_Card Wide" onClick={(e) => e.stopPropagation()} onSubmit={submit}>
        <div className="Popover_Header">
          <div className="Popover_Header_Text">
            <span className="Popover_Title">{role ? role.name : t('companyRoles.newTitle')}</span>
            <span className="Popover_Subtitle">{t('companyRoles.popoverSubtitle')}</span>
          </div>
          <button type="button" className="Popover_Close" onClick={onClose} aria-label={t('common.cancel')}>
            ×
          </button>
        </div>

        <div className="Popover_Body Single_Column">
          <div className="Role_Fields">
            <div className="Form_Field">
              <label htmlFor="role-name">{t('companyRoles.name')} *</label>
              <Global_Input id="role-name" value={name} onChange={(e) => setName(e.target.value)} disabled={readOnly} />
            </div>
            <div className="Form_Field">
              <label htmlFor="role-description">{t('companyRoles.description')}</label>
              <Global_Input
                id="role-description"
                value={description}
                onChange={(e) => setDescription(e.target.value)}
                disabled={readOnly}
              />
            </div>
          </div>

          <div className="Form_Field">
            <label>{t('companyRoles.permissions')}</label>
            <span className="Field_Hint">{t('companyRoles.gridHint')}</span>
            <Permission_Grid catalog={catalog} value={permissions} onChange={setPermissions} disabled={readOnly} />
          </div>
        </div>

        <div className="Popover_Footer">
          <div className="Form_Action">
            <Simple_Button text={readOnly ? t('common.close') : t('common.cancel')} onClick={onClose} variant="Ghost" />
          </div>
          {!readOnly && (
            <div className="Form_Action">
              <Simple_Button
                type="submit"
                text={saving ? t('common.saving') : t('common.save')}
                disabled={saving || !name.trim()}
              />
            </div>
          )}
        </div>
      </form>
    </div>
  );
};

export default Role_Popover;

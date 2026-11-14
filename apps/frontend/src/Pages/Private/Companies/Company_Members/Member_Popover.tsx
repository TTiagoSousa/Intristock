import { useEffect, useState } from 'react';
import { useTranslation } from 'react-i18next';
import Global_Input from '../../../../Components/Inputs/Global_Input/Global_Input';
import Global_Dropdown from '../../../../Components/Inputs/Global_Dropdown/Global_Dropdown';
import Simple_Button from '../../../../Components/Buttons/Simple_Button/Simple_Button';
import type {
  Company_Member,
  Company_Role,
  Member_Add_Input,
  Member_Update,
} from '../../../../Hooks/Companies/useCompanyAccessAdmin';
import type { CompanyPermission, CompanyPermissionArea } from '../../../../Hooks/Companies/companyPermissions';
import Permission_Grid from './Permission_Grid';

const NO_ROLE = '';

// Com conta entra na app (com cargo); sem conta é só um registo, para os salários e os dados
type Add_Mode = 'account' | 'record';

interface Member_Popover_Props {
  catalog: CompanyPermissionArea[];
  roles: Company_Role[];
  // Sem membro é para adicionar um (pelo email)
  member: Company_Member | null;
  saving: boolean;
  readOnly: boolean;
  onClose: () => void;
  onAdd: (input: Member_Add_Input) => void;
  onUpdate: (update: Member_Update) => void;
}

/**
 * Adicionar um membro — uma conta (email e cargo) ou uma pessoa sem conta (nome,
 * função e email de contacto) — ou editar o acesso de um com conta: o cargo e,
 * na grelha, o que fica a ter. O que difere do cargo grava-se como ajuste dele — "+" a mais,
 * "−" tirada — e mudar o cargo mais tarde mantém os ajustes.
 */
const Member_Popover = ({ catalog, roles, member, saving, readOnly, onClose, onAdd, onUpdate }: Member_Popover_Props) => {
  const { t } = useTranslation();
  const [mode, setMode] = useState<Add_Mode>('account');
  const [email, setEmail] = useState('');
  const [name, setName] = useState('');
  const [jobTitle, setJobTitle] = useState('');
  const [contactEmail, setContactEmail] = useState('');
  const [roleId, setRoleId] = useState(member?.role?.id ?? NO_ROLE);
  const [extra, setExtra] = useState<CompanyPermission[]>(member?.extraPermissions ?? []);
  const [denied, setDenied] = useState<CompanyPermission[]>(member?.deniedPermissions ?? []);

  useEffect(() => {
    const handleEscape = (e: KeyboardEvent) => {
      if (e.key === 'Escape') onClose();
    };
    document.addEventListener('keydown', handleEscape);
    return () => document.removeEventListener('keydown', handleEscape);
  }, [onClose]);

  const base = roles.find((role) => role.id === roleId)?.permissions ?? [];
  const effective = [...base.filter((p) => !denied.includes(p)), ...extra.filter((p) => !base.includes(p))];

  // A grelha diz o que fica a ter; daqui saem os ajustes ao cargo
  const changeEffective = (next: CompanyPermission[]) => {
    setExtra(next.filter((p) => !base.includes(p)));
    setDenied(base.filter((p) => !next.includes(p)));
  };

  const submit = (event: React.FormEvent) => {
    event.preventDefault();
    if (readOnly) return;
    if (!member) {
      if (mode === 'record') {
        if (name.trim()) {
          onAdd({
            name: name.trim(),
            ...(jobTitle.trim() ? { jobTitle: jobTitle.trim() } : {}),
            ...(contactEmail.trim() ? { email: contactEmail.trim() } : {}),
          });
        }
        return;
      }
      if (email.trim()) onAdd({ accountEmail: email.trim(), ...(roleId ? { roleId } : {}) });
      return;
    }
    // Só se guardam os ajustes que ainda diferem do cargo escolhido
    onUpdate({
      roleId: roleId || null,
      extraPermissions: extra.filter((p) => !base.includes(p)),
      deniedPermissions: denied.filter((p) => base.includes(p)),
    });
  };

  const roleOptions = [
    { value: NO_ROLE, label: t('companyMembers.noRole') },
    ...roles.map((role) => ({ value: role.id, label: role.name })),
  ];

  return (
    <div className="Popover_Backdrop" onClick={onClose}>
      <form className={`Popover_Card ${member ? 'Wide' : 'Narrow'}`} onClick={(e) => e.stopPropagation()} onSubmit={submit}>
        <div className="Popover_Header">
          <div className="Popover_Header_Text">
            <span className="Popover_Title">{member ? member.name : t('companyMembers.addTitle')}</span>
            <span className="Popover_Subtitle">
              {member
                ? member.user?.email
                : t(mode === 'record' ? 'companyMembers.addRecordSubtitle' : 'companyMembers.addSubtitle')}
            </span>
          </div>
          <button type="button" className="Popover_Close" onClick={onClose} aria-label={t('common.cancel')}>
            ×
          </button>
        </div>

        <div className="Popover_Body Single_Column">
          {!member && (
            <div className="Form_Field">
              <div className="Tabs">
                {(['account', 'record'] as Add_Mode[]).map((option) => (
                  <button
                    key={option}
                    type="button"
                    className={mode === option ? 'Active' : ''}
                    onClick={() => setMode(option)}
                  >
                    {t(`companyMembers.mode_${option}`)}
                  </button>
                ))}
              </div>
              <span className="Field_Hint">{t(`companyMembers.mode_${mode}Hint`)}</span>
            </div>
          )}

          {!member && mode === 'record' && (
            <>
              <div className="Form_Field">
                <label htmlFor="member-name">{t('companyMembers.name')} *</label>
                <Global_Input id="member-name" value={name} onChange={(e) => setName(e.target.value)} />
              </div>
              <div className="Form_Field">
                <label htmlFor="member-job">{t('memberProfile.jobTitle')}</label>
                <Global_Input id="member-job" value={jobTitle} onChange={(e) => setJobTitle(e.target.value)} />
              </div>
              <div className="Form_Field">
                <label htmlFor="member-contact-email">{t('memberProfile.email')}</label>
                <Global_Input
                  id="member-contact-email"
                  type="email"
                  value={contactEmail}
                  onChange={(e) => setContactEmail(e.target.value)}
                />
              </div>
            </>
          )}

          {!member && mode === 'account' && (
            <div className="Form_Field">
              <label htmlFor="member-email">{t('companyMembers.email')} *</label>
              <Global_Input id="member-email" type="email" value={email} onChange={(e) => setEmail(e.target.value)} />
              <span className="Field_Hint">{t('companyMembers.emailHint')}</span>
            </div>
          )}

          {(member || mode === 'account') && (
            <div className="Form_Field">
              <label htmlFor="member-role">{t('companyMembers.role')}</label>
              <Global_Dropdown
                id="member-role"
                value={roleId}
                onChange={(value) => setRoleId(String(value))}
                options={roleOptions}
                disabled={readOnly}
              />
              <span className="Field_Hint">{t(roleId ? 'companyMembers.roleHint' : 'companyMembers.noRoleHint')}</span>
            </div>
          )}

          {member && (
            <div className="Form_Field">
              <label>{t('companyMembers.permissions')}</label>
              <span className="Field_Hint">{t('companyMembers.gridHint')}</span>
              <Permission_Grid
                catalog={catalog}
                value={effective}
                base={base}
                onChange={changeEffective}
                disabled={readOnly}
              />
            </div>
          )}
        </div>

        <div className="Popover_Footer">
          <div className="Form_Action">
            <Simple_Button text={readOnly ? t('common.close') : t('common.cancel')} onClick={onClose} variant="Ghost" />
          </div>
          {!readOnly && (
            <div className="Form_Action">
              <Simple_Button
                type="submit"
                text={saving ? t('common.saving') : member ? t('common.save') : t('companyMembers.add')}
                disabled={saving || (!member && !(mode === 'record' ? name.trim() : email.trim()))}
              />
            </div>
          )}
        </div>
      </form>
    </div>
  );
};

export default Member_Popover;

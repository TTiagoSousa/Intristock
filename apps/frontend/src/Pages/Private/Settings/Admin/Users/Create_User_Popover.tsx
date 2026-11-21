import { useState } from 'react';
import { useTranslation } from 'react-i18next';
import { useAlert } from '../../../../../Contexts/Alert_Context';
import Global_Input from '../../../../../Components/Inputs/Global_Input/Global_Input';
import Global_Dropdown from '../../../../../Components/Inputs/Global_Dropdown/Global_Dropdown';
import Simple_Button from '../../../../../Components/Buttons/Simple_Button/Simple_Button';
import type { CreateUserPayload, Managed_User, UpdateUserPayload, UserRole } from '../../../../../Hooks/Admin/useUsers';
import Popover_Shell from '../../../../../Components/Popover_Shell/Popover_Shell';

interface Create_User_Popover_Props {
  saving: boolean;
  // Com um utilizador, edita-o; sem ele, cria um novo
  user?: Managed_User;
  onClose: () => void;
  onCreate: (payload: CreateUserPayload) => Promise<boolean>;
  onUpdate: (id: string, payload: UpdateUserPayload) => Promise<boolean>;
}

const Create_User_Popover = ({ saving, user, onClose, onCreate, onUpdate }: Create_User_Popover_Props) => {
  const { t } = useTranslation();
  const { setAlert } = useAlert();
  const isEdit = Boolean(user);

  const [fullName, setFullName] = useState(user?.fullName ?? '');
  const [email, setEmail] = useState(user?.email ?? '');
  const [password, setPassword] = useState('');
  const [role, setRole] = useState<UserRole>(user?.role ?? 'USER');
  const [active, setActive] = useState(user?.active ?? true);

  const handleSubmit = async (event: React.FormEvent) => {
    event.preventDefault();

    // As mesmas regras do backend, para não gastar um pedido; a editar, a password
    // em branco fica a que está
    if (fullName.trim().length < 2) {
      setAlert({ open: true, message: t('adminUsers.nameTooShort'), type: 'error' });
      return;
    }
    if ((!isEdit || password) && password.length < 8) {
      setAlert({ open: true, message: t('adminUsers.passwordTooShort'), type: 'error' });
      return;
    }

    const saved = user
      ? await onUpdate(user.id, {
          fullName: fullName.trim(),
          email: email.trim(),
          role,
          active,
          ...(password ? { password } : {}),
        })
      : await onCreate({ fullName: fullName.trim(), email: email.trim(), password, role });
    if (saved) onClose();
  };

  return (
    <Popover_Shell onClose={onClose} as="form" className="Narrow" onSubmit={handleSubmit}>
      <div className="Popover_Header">
        <div className="Popover_Header_Text">
          <span className="Popover_Title">{t(isEdit ? 'adminUsers.editTitle' : 'adminUsers.newTitle')}</span>
          <span className="Popover_Subtitle">{isEdit ? user?.email : t('adminUsers.newSubtitle')}</span>
        </div>
        <button type="button" className="Popover_Close" onClick={onClose} aria-label={t('common.cancel')}>
          ×
        </button>
      </div>

      <div className="Popover_Body">
        <div className="Form_Field">
          <label htmlFor="user-name">{t('adminUsers.name')} *</label>
          <Global_Input id="user-name" value={fullName} onChange={(e) => setFullName(e.target.value)} />
        </div>

        <div className="Form_Field">
          <label htmlFor="user-email">{t('adminUsers.email')} *</label>
          <Global_Input id="user-email" type="email" value={email} onChange={(e) => setEmail(e.target.value)} />
          <span className="Field_Hint">{t('adminUsers.emailHint')}</span>
        </div>

        <div className="Form_Field">
          <label htmlFor="user-password">
            {t(isEdit ? 'adminUsers.newPassword' : 'adminUsers.password')}
            {isEdit ? '' : ' *'}
          </label>
          <Global_Input
            id="user-password"
            type="password"
            value={password}
            onChange={(e) => setPassword(e.target.value)}
          />
          <span className="Field_Hint">{t(isEdit ? 'adminUsers.newPasswordHint' : 'adminUsers.passwordHint')}</span>
        </div>

        <div className="Form_Field">
          <label htmlFor="user-role">{t('adminUsers.role')}</label>
          <Global_Dropdown
            id="user-role"
            value={role}
            onChange={(value) => setRole(value as UserRole)}
            options={[
              { value: 'USER', label: t('adminUsers.roles.USER') },
              { value: 'ADMIN', label: t('adminUsers.roles.ADMIN') },
            ]}
          />
          <span className="Field_Hint">{t('adminUsers.roleHint')}</span>
        </div>

        {isEdit && (
          <div className="Form_Field">
            <label htmlFor="user-status">{t('adminUsers.status')}</label>
            <Global_Dropdown
              id="user-status"
              value={active ? 'active' : 'inactive'}
              onChange={(value) => setActive(value === 'active')}
              options={[
                { value: 'active', label: t('adminUsers.active') },
                { value: 'inactive', label: t('adminUsers.inactive') },
              ]}
            />
            <span className="Field_Hint">{t('adminUsers.statusHint')}</span>
          </div>
        )}
      </div>

      <div className="Popover_Footer">
        <div className="Form_Action">
          <Simple_Button text={t('common.cancel')} onClick={onClose} variant="Ghost" />
        </div>
        <div className="Form_Action">
          <Simple_Button
            type="submit"
            text={t(isEdit ? 'common.save' : 'adminUsers.create')}
            disabled={saving}
          />
        </div>
      </div>
    </Popover_Shell>
  );
};

export default Create_User_Popover;

import { useState } from 'react';
import { useTranslation } from 'react-i18next';
import { useAlert } from '../../../../Contexts/Alert_Context';
import { useChangePassword } from '../../../../Hooks/Settings/useChangePassword';
import Global_Input from '../../../../Components/Inputs/Global_Input/Global_Input';
import Simple_Button from '../../../../Components/Buttons/Simple_Button/Simple_Button';
import './Security.scss';

const MIN_LENGTH = 8;

const Security = () => {
  const { t } = useTranslation();
  const { setAlert } = useAlert();
  const { saving, changePassword } = useChangePassword();

  const [currentPassword, setCurrentPassword] = useState('');
  const [newPassword, setNewPassword] = useState('');
  const [confirmPassword, setConfirmPassword] = useState('');

  const handleSubmit = async (event: React.FormEvent) => {
    event.preventDefault();

    if (newPassword.length < MIN_LENGTH) {
      setAlert({ open: true, message: t('security.tooShort'), type: 'error' });
      return;
    }
    if (newPassword !== confirmPassword) {
      setAlert({ open: true, message: t('security.mismatch'), type: 'error' });
      return;
    }

    const changed = await changePassword(currentPassword, newPassword);
    if (changed) {
      setCurrentPassword('');
      setNewPassword('');
      setConfirmPassword('');
    }
  };

  return (
    <div className="Security">
      <form className="Card Security_Card" onSubmit={handleSubmit}>
        <div className="Card_Header">
          <div className="Card_Header_Text">
            <span className="Card_Title">{t('security.changeTitle')}</span>
            <span className="Security_Subtitle">{t('security.subtitle')}</span>
          </div>
        </div>

        <div className="Settings_List">
          <div className="Setting_Row">
            <div className="Setting_Text">
              <span className="Setting_Label">{t('security.currentPassword')}</span>
              <span className="Setting_Hint">{t('security.currentPasswordHint')}</span>
            </div>
            <div className="Setting_Control">
              <Global_Input
                id="current-password"
                type="password"
                autoComplete="current-password"
                value={currentPassword}
                onChange={(e) => setCurrentPassword(e.target.value)}
              />
            </div>
          </div>

          <div className="Setting_Row">
            <div className="Setting_Text">
              <span className="Setting_Label">{t('security.newPassword')}</span>
              <span className="Setting_Hint">{t('security.newPasswordHint')}</span>
            </div>
            <div className="Setting_Control">
              <Global_Input
                id="new-password"
                type="password"
                autoComplete="new-password"
                value={newPassword}
                onChange={(e) => setNewPassword(e.target.value)}
              />
            </div>
          </div>

          <div className="Setting_Row">
            <div className="Setting_Text">
              <span className="Setting_Label">{t('security.confirmPassword')}</span>
            </div>
            <div className="Setting_Control">
              <Global_Input
                id="confirm-password"
                type="password"
                autoComplete="new-password"
                value={confirmPassword}
                onChange={(e) => setConfirmPassword(e.target.value)}
              />
            </div>
          </div>
        </div>

        <div className="Security_Foot">
          <Simple_Button
            type="submit"
            text={saving ? t('common.saving') : t('security.change')}
            disabled={saving || !currentPassword || !newPassword || !confirmPassword}
            small
            auto
          />
        </div>
      </form>
    </div>
  );
};

export default Security;

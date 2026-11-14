import { useTranslation } from 'react-i18next';
import http from '../../Service/httpService';
import { End_Points } from '../../Service/endPoints';
import { useAlert } from '../../Contexts/Alert_Context';
import { useAsyncRequest } from '../useAsyncRequest';

export const useChangePassword = () => {
  const { loading: saving, run } = useAsyncRequest();
  const { setAlert } = useAlert();
  const { t } = useTranslation();

  const changePassword = async (currentPassword: string, newPassword: string): Promise<boolean> => {
    const response = await run(() =>
      http.patch(End_Points.Change_Password_Endpoint(), { currentPassword, newPassword }),
    );
    if (!response) return false;

    setAlert({ open: true, message: t('security.passwordChanged'), type: 'success' });
    return true;
  };

  return { saving, changePassword };
};

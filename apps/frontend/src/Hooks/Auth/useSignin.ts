import { useState } from "react";
import { useTranslation } from "react-i18next";
import { End_Points } from "../../Service/endPoints";
import http from "../../Service/httpService";
import { useAlert } from "../../Contexts/Alert_Context";

export const useSignin = () => {
  const [signInEmail, setSignInEmail] = useState('');
  const [signInpassword, setSignInpassword] = useState('');
  const [loading, setLoading] = useState(false);

  const { setAlert } = useAlert();
  const { t, i18n } = useTranslation();

  const signin = async (rememberMe: boolean = false) => {

    if (!signInEmail || !signInpassword) {
      return setAlert({
        open: true,
        message: t('auth.fieldsRequired'),
        type: 'error'
      });
    }

    setLoading(true);

    try {

      await http.post(
        End_Points.Sign_In_Endpoint(),
        { email: signInEmail, password: signInpassword, rememberMe },
        { withCredentials: true }
      );

      setAlert({
        open: true,
        message: t('auth.loginSuccess'),
        type: 'success',
      });

      setTimeout(() => {
        window.location.href = '/Dashboard';
      }, 300);

    } catch (error: any) {

      const data = error.response?.data;
      // Conta bloqueada: a data na hora de quem tenta entrar, e o motivo se houver
      const msg = data?.blockedUntil
        ? t(data.blockedReason ? 'auth.blockedWithReason' : 'auth.blocked', {
            date: new Date(data.blockedUntil).toLocaleString(i18n.language === 'pt' ? 'pt-PT' : 'en-GB', {
              dateStyle: 'short',
              timeStyle: 'short',
            }),
            reason: data.blockedReason,
          })
        : data?.message || error.message || t('auth.genericError');

      setAlert({
        open: true,
        message: msg,
        type: 'error',
      });
    } finally {
      setLoading(false);
    }
  };

  return {
    signInEmail,
    setSignInEmail,
    signInpassword,
    setSignInpassword,
    signin,
    loading,
  };
};

import { useState } from "react";
import { useTranslation } from "react-i18next";
import { End_Points } from "../../Service/endPoints";
import http from "../../Service/httpService";
import { useAlert } from "../../Contexts/Alert_Context";
import { safeNextPath } from "../../utils/nextPath";
import { localeOf } from "../../utils/locale";

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

      // Volta à página que pediu o login (?next=), ou ao Dashboard. O botão
      // fica desativado até sair da página.
      const next = safeNextPath(new URLSearchParams(window.location.search).get('next'));
      setTimeout(() => {
        window.location.href = next;
      }, 300);

    } catch (error: any) {

      const data = error.response?.data;
      // Conta bloqueada: a data na hora de quem tenta entrar, e o motivo se houver
      const msg = data?.blockedUntil
        ? t(data.blockedReason ? 'auth.blockedWithReason' : 'auth.blocked', {
            date: new Date(data.blockedUntil).toLocaleString(localeOf(i18n.language), {
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

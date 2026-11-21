import { useState } from 'react';
import i18n from '../i18n/i18n';
import { useAlert } from '../Contexts/Alert_Context';

// A mensagem do backend (também a do limite de pedidos, 429, e a do CSRF, 403/415);
// a validação dá uma lista, que se junta. Sem nenhuma, um texto na língua da app.
export const getErrorMessage = (error: any): string => {
  const message = error?.response?.data?.message;
  if (Array.isArray(message) && message.length) return message.join('; ');
  if (typeof message === 'string' && message) return message;
  if (error?.response?.status === 429) return i18n.t('errors.tooManyRequests');
  return error?.message || i18n.t('errors.generic');
};

export const useAsyncRequest = (initialLoading = false) => {
  const [loading, setLoading] = useState(initialLoading);
  const { setAlert } = useAlert();

  const run = async <T,>(request: () => Promise<T>): Promise<T | undefined> => {
    setLoading(true);

    try {
      return await request();
    } catch (error: any) {
      setAlert({ open: true, message: getErrorMessage(error), type: 'error' });
      return undefined;
    } finally {
      setLoading(false);
    }
  };

  return { loading, run };
};

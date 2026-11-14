import { useState } from 'react';
import { useAlert } from '../Contexts/Alert_Context';

export const getErrorMessage = (error: any) =>
  error.response?.data?.message || error.message || 'Something went wrong';

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

import { useEffect, useState } from 'react';
import { useTranslation } from 'react-i18next';
import http from '../../Service/httpService';
import { End_Points } from '../../Service/endPoints';
import { useAlert } from '../../Contexts/Alert_Context';
import { useAsyncRequest } from '../useAsyncRequest';

export type UserRole = 'ADMIN' | 'USER';

export interface Managed_User {
  id: string;
  email: string;
  fullName: string;
  role: UserRole;
  active: boolean;
  blockedUntil: string | null;
  blockedReason: string | null;
  createdAt: string;
}

export interface CreateUserPayload {
  fullName: string;
  email: string;
  password: string;
  role: UserRole;
}

export interface UpdateUserPayload {
  fullName: string;
  email: string;
  role: UserRole;
  active: boolean;
  password?: string;
}

/// Bloqueado agora: o bloqueio acaba sozinho quando a data passa
export const isUserBlocked = (user: Managed_User) =>
  user.blockedUntil !== null && new Date(user.blockedUntil).getTime() > Date.now();

export const useUsers = () => {
  const [users, setUsers] = useState<Managed_User[]>([]);
  const { loading, run } = useAsyncRequest(true);
  const { loading: saving, run: runSave } = useAsyncRequest();
  const { setAlert } = useAlert();
  const { t } = useTranslation();

  const refresh = async () => {
    const response = await run(() => http.get<Managed_User[]>(End_Points.Users_Endpoint()));
    if (response) setUsers(response.data);
  };

  useEffect(() => {
    refresh();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  const replace = (user: Managed_User) =>
    setUsers((current) => current.map((item) => (item.id === user.id ? user : item)));

  const createUser = async (payload: CreateUserPayload): Promise<boolean> => {
    const response = await runSave(() => http.post<Managed_User>(End_Points.Users_Endpoint(), payload));
    if (!response) return false;

    setUsers((current) => [...current, response.data]);
    setAlert({ open: true, message: t('adminUsers.created'), type: 'success' });
    return true;
  };

  const updateUser = async (id: string, payload: UpdateUserPayload): Promise<boolean> => {
    const response = await runSave(() => http.patch<Managed_User>(End_Points.Managed_User_Endpoint(id), payload));
    if (!response) return false;

    replace(response.data);
    setAlert({ open: true, message: t('adminUsers.updated'), type: 'success' });
    return true;
  };

  const deleteUser = async (id: string): Promise<boolean> => {
    const response = await runSave(() => http.delete(End_Points.Managed_User_Endpoint(id)));
    if (!response) return false;

    setUsers((current) => current.filter((item) => item.id !== id));
    setAlert({ open: true, message: t('adminUsers.deleted'), type: 'success' });
    return true;
  };

  const blockUser = async (id: string, until: Date, reason: string): Promise<boolean> => {
    const response = await runSave(() =>
      http.post<Managed_User>(End_Points.User_Block_Endpoint(id), { until: until.toISOString(), reason }),
    );
    if (!response) return false;

    replace(response.data);
    setAlert({ open: true, message: t('adminUsers.blocked'), type: 'success' });
    return true;
  };

  const unblockUser = async (id: string): Promise<boolean> => {
    const response = await runSave(() => http.delete<Managed_User>(End_Points.User_Block_Endpoint(id)));
    if (!response) return false;

    replace(response.data);
    setAlert({ open: true, message: t('adminUsers.unblocked'), type: 'success' });
    return true;
  };

  return { users, loading, saving, createUser, updateUser, deleteUser, blockUser, unblockUser };
};

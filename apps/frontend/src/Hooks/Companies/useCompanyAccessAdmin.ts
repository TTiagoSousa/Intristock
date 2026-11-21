import { useEffect, useState } from 'react';
import { useTranslation } from 'react-i18next';
import http from '../../Service/httpService';
import { End_Points } from '../../Service/endPoints';
import { useAlert } from '../../Contexts/Alert_Context';
import { getErrorMessage } from '../useAsyncRequest';
import type { CompanyPermission, CompanyPermissionArea } from './companyPermissions';

export interface Company_Role {
  id: string;
  name: string;
  description: string | null;
  permissions: CompanyPermission[];
  memberCount: number;
}

export interface Company_Member {
  id: string;
  // Sem conta (só um registo, para os salários e os dados) vem nulo
  user: { id: string; email: string; fullName: string } | null;
  // O dos dados, ou o da conta
  name: string;
  email: string | null;
  jobTitle: string | null;
  role: { id: string; name: string } | null;
  extraPermissions: CompanyPermission[];
  deniedPermissions: CompanyPermission[];
  // As que tem no fim: cargo + extra − tiradas
  permissions: CompanyPermission[];
  // invited (convite por aceitar) | active | declined
  status: 'invited' | 'active' | 'declined';
  createdAt: string;
}

export interface Company_Members {
  owner: { id: string; email: string; fullName: string } | null;
  members: Company_Member[];
}

export interface Role_Input {
  name: string;
  description: string;
  permissions: CompanyPermission[];
}

// Com `accountEmail` junta uma conta; sem ele, um membro sem conta (com nome)
export interface Member_Add_Input {
  accountEmail?: string;
  roleId?: string;
  name?: string;
  jobTitle?: string;
  email?: string;
}

export interface Member_Update {
  roleId?: string | null;
  extraPermissions?: CompanyPermission[];
  deniedPermissions?: CompanyPermission[];
}

/**
 * Os cargos, os membros e a lista das permissões de uma empresa, para as
 * páginas Membros e Cargos. Cada gravação volta a ler os dois: mudar um cargo
 * muda as permissões de quem o tem.
 */
export const useCompanyAccessAdmin = (companyId: string | undefined) => {
  const [catalog, setCatalog] = useState<CompanyPermissionArea[]>([]);
  const [roles, setRoles] = useState<Company_Role[]>([]);
  const [members, setMembers] = useState<Company_Members>({ owner: null, members: [] });
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const { setAlert } = useAlert();
  const { t } = useTranslation();

  // O estado só muda nos callbacks, quando as respostas chegam
  const load = (id: string) =>
    Promise.all([
      http.get<CompanyPermissionArea[]>(End_Points.Company_Permissions_Endpoint()),
      http.get<Company_Role[]>(End_Points.Company_Roles_Endpoint(id)),
      http.get<Company_Members>(End_Points.Company_Members_Endpoint(id)),
    ])
      .then(([catalogResponse, rolesResponse, membersResponse]) => {
        setCatalog(catalogResponse.data);
        setRoles(rolesResponse.data);
        setMembers(membersResponse.data);
      })
      .catch((error) => setAlert({ open: true, message: getErrorMessage(error), type: 'error' }))
      .finally(() => setLoading(false));

  useEffect(() => {
    if (companyId) load(companyId);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [companyId]);

  // Grava, mostra o aviso e volta a ler; devolve se correu bem
  const mutate = async (request: () => Promise<unknown>, successKey: string) => {
    if (!companyId) return false;
    setSaving(true);
    try {
      await request();
      await load(companyId);
      setAlert({ open: true, message: t(successKey), type: 'success' });
      return true;
    } catch (error) {
      setAlert({ open: true, message: getErrorMessage(error), type: 'error' });
      return false;
    } finally {
      setSaving(false);
    }
  };

  const id = companyId ?? '';

  return {
    catalog,
    roles,
    members,
    loading,
    saving,
    createRole: (input: Role_Input) =>
      mutate(() => http.post(End_Points.Company_Roles_Endpoint(id), input), 'companyRoles.created'),
    updateRole: (roleId: string, input: Role_Input) =>
      mutate(() => http.patch(End_Points.Company_Role_Endpoint(id, roleId), input), 'companyRoles.updated'),
    deleteRole: (roleId: string) =>
      mutate(() => http.delete(End_Points.Company_Role_Endpoint(id, roleId)), 'companyRoles.deleted'),
    addMember: (input: Member_Add_Input) =>
      // Com uma conta é um convite (entra quando a pessoa aceitar); sem ela, um registo
      mutate(
        () => http.post(End_Points.Company_Members_Endpoint(id), input),
        input.accountEmail ? 'companyMembers.invited' : 'companyMembers.added',
      ),
    updateMember: (memberId: string, update: Member_Update) =>
      mutate(() => http.patch(End_Points.Company_Member_Endpoint(id, memberId), update), 'companyMembers.updated'),
    removeMember: (memberId: string) =>
      mutate(() => http.delete(End_Points.Company_Member_Endpoint(id, memberId)), 'companyMembers.removed'),
  };
};

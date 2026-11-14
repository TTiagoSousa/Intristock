// As permissões de um cargo numa empresa ("payments.create"). A lista vem do
// backend (`GET /company-permissions`, `COMPANY_PERMISSION_AREAS`); aqui só o tipo.
export type CompanyPermission = `${string}.${string}`;

export interface CompanyAccess {
  owner: boolean;
  roleName: string | null;
  permissions: CompanyPermission[];
}

export interface CompanyPermissionArea {
  area: string;
  actions: string[];
}

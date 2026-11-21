/**
 * As permissões que um cargo de uma empresa pode dar, por área. Vivem no código
 * porque só valem alguma coisa onde há código que as verifique
 * (`assertCompanyAccess(..., { permission })`): uma área nova junta aqui as suas
 * e as traduções em `companyRoles.areas.<área>` / `companyRoles.actions.<ação>`.
 *
 * O frontend recebe esta lista (`GET /company-permissions`) para desenhar a
 * grelha dos cargos.
 */
export const COMPANY_PERMISSION_AREAS = {
  settings: ['view', 'edit'],
  members: ['view', 'manage'],
  // Os salários, os recibos verdes, os contratos e os documentos dos membros
  salaries: ['view', 'manage'],
  modules: ['view', 'edit'],
  suppliers: ['view', 'create', 'edit', 'delete'],
  items: ['view', 'create', 'edit', 'delete'],
  payments: ['view', 'create', 'edit', 'delete'],
  stock: ['view', 'create', 'delete'],
  assets: ['view', 'create', 'edit', 'delete'],
  trading: ['view', 'create', 'edit', 'delete'],
  // O banco de horas: ver as horas e os pagamentos; gerir as ligações, os clientes, as pessoas e marcar pagos
  timesheet: ['view', 'manage'],
} as const;

type Areas = typeof COMPANY_PERMISSION_AREAS;
export type CompanyPermissionArea = keyof Areas;
export type CompanyPermission = {
  [A in CompanyPermissionArea]: `${A}.${Areas[A][number]}`;
}[CompanyPermissionArea];

export const COMPANY_PERMISSIONS = Object.entries(COMPANY_PERMISSION_AREAS).flatMap(([area, actions]) =>
  actions.map((action) => `${area}.${action}`),
) as CompanyPermission[];

const VALID = new Set<string>(COMPANY_PERMISSIONS);

export const isCompanyPermission = (value: string): value is CompanyPermission => VALID.has(value);

/** Ver é ler; tudo o resto grava (e uma empresa desativada não aceita). */
export const isWritePermission = (permission: CompanyPermission) => !permission.endsWith('.view');

/**
 * As permissões de um membro: as do cargo, mais as que lhe deram a mais, menos
 * as que lhe tiraram. Uma permissão que já não exista no código não conta.
 */
export function resolveMemberPermissions(member: {
  role: { permissions: string[] } | null;
  extraPermissions: string[];
  deniedPermissions: string[];
}): CompanyPermission[] {
  const denied = new Set(member.deniedPermissions);
  const granted = new Set([...(member.role?.permissions ?? []), ...member.extraPermissions]);
  return COMPANY_PERMISSIONS.filter((p) => granted.has(p) && !denied.has(p));
}

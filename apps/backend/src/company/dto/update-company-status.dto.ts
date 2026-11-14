import { IsIn } from 'class-validator';

// Só estes dois: `deleted` não se põe por aqui, chega-se lá pelo DELETE, e
// sair de lá não é coisa que o dono faça sozinho.
export const COMPANY_TOGGLE_STATUSES = ['active', 'inactive'] as const;
export type CompanyToggleStatus = (typeof COMPANY_TOGGLE_STATUSES)[number];

export class UpdateCompanyStatusDto {
  @IsIn(COMPANY_TOGGLE_STATUSES)
  status: CompanyToggleStatus;
}

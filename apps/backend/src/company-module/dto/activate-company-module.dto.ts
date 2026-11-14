import { IsUUID } from 'class-validator';

// O companyId vem do parâmetro da rota (`/company/:companyId/modules`)
export class ActivateCompanyModuleDto {
  @IsUUID()
  moduleId: string;
}

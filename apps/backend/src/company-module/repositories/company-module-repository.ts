import { CompanyModule, Module as SystemModule } from 'src/generated/prisma/client/client';

export type CompanyModuleWithModule = CompanyModule & { module: SystemModule };

export interface CompanyModuleRepository {
  create(data: { companyId: string; moduleId: string }): Promise<CompanyModuleWithModule>;
  setActive(id: string, isActive: boolean): Promise<CompanyModuleWithModule>;
  findByCompanyAndModule(
    companyId: string,
    moduleId: string,
  ): Promise<CompanyModuleWithModule | null>;
  findAllByCompanyId(companyId: string): Promise<CompanyModuleWithModule[]>;
}

import { Injectable } from '@nestjs/common';
import { PrismaCompanyModuleRepository } from './repositories/prisma/prisma-company-module-repository';
import { PrismaCompanyRepository } from 'src/company/repositories/prisma/prisma-company-repository';
import { PrismaModuleRepository } from 'src/module/repositories/prisma/prisma-module-repository';
import { activateCompanyModule } from './helpers/activateCompanyModule';
import { toggleCompanyModule } from './helpers/toggleCompanyModule';
import { findCompanyModules } from './helpers/findCompanyModules';
import { ActivateCompanyModuleDto } from './dto/activate-company-module.dto';
import { ToggleCompanyModuleDto } from './dto/toggle-company-module.dto';

@Injectable()
export class CompanyModuleService {
  constructor(
    private readonly companyModuleRepository: PrismaCompanyModuleRepository,
    private readonly companyRepository: PrismaCompanyRepository,
    private readonly moduleRepository: PrismaModuleRepository,
  ) {}

  async activate(userId: string, companyId: string, dto: ActivateCompanyModuleDto) {
    return activateCompanyModule(
      userId,
      companyId,
      dto,
      this.companyModuleRepository,
      this.companyRepository,
      this.moduleRepository,
    );
  }

  async toggle(
    userId: string,
    companyId: string,
    moduleId: string,
    dto: ToggleCompanyModuleDto,
  ) {
    return toggleCompanyModule(
      userId,
      companyId,
      moduleId,
      dto,
      this.companyModuleRepository,
      this.companyRepository,
    );
  }

  async findAll(userId: string, companyId: string) {
    return findCompanyModules(
      userId,
      companyId,
      this.companyModuleRepository,
      this.companyRepository,
    );
  }
}

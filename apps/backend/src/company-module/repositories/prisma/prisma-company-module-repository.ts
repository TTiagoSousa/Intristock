import { Injectable } from '@nestjs/common';
import { PrismaService } from 'src/prisma/prisma.service';
import { CompanyModuleRepository, CompanyModuleWithModule } from '../company-module-repository';

@Injectable()
export class PrismaCompanyModuleRepository implements CompanyModuleRepository {
  constructor(private readonly prisma: PrismaService) {}

  async create(data: { companyId: string; moduleId: string }): Promise<CompanyModuleWithModule> {
    return this.prisma.companyModule.create({
      data,
      include: { module: true },
    });
  }

  async setActive(id: string, isActive: boolean): Promise<CompanyModuleWithModule> {
    return this.prisma.companyModule.update({
      where: { id },
      data: { isActive },
      include: { module: true },
    });
  }

  async findByCompanyAndModule(
    companyId: string,
    moduleId: string,
  ): Promise<CompanyModuleWithModule | null> {
    return this.prisma.companyModule.findUnique({
      where: { companyId_moduleId: { companyId, moduleId } },
      include: { module: true },
    });
  }

  async findAllByCompanyId(companyId: string): Promise<CompanyModuleWithModule[]> {
    return this.prisma.companyModule.findMany({
      where: { companyId },
      orderBy: { module: { label: 'asc' } },
      include: { module: true },
    });
  }
}

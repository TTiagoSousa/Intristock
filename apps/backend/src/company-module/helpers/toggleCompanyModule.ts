import { BadRequestException, NotFoundException } from '@nestjs/common';
import { PrismaCompanyModuleRepository } from '../repositories/prisma/prisma-company-module-repository';
import { PrismaCompanyRepository } from 'src/company/repositories/prisma/prisma-company-repository';
import { assertCompanyOwnership } from './assertCompanyOwnership';
import { ToggleCompanyModuleDto } from '../dto/toggle-company-module.dto';

export async function toggleCompanyModule(
  userId: string,
  companyId: string,
  moduleId: string,
  dto: ToggleCompanyModuleDto,
  companyModuleRepository: PrismaCompanyModuleRepository,
  companyRepository: PrismaCompanyRepository,
) {
  // 1. A empresa tem de existir e ser de quem está a pedir
  await assertCompanyOwnership(userId, companyId, companyRepository, 'modules.edit');

  // 2. O módulo tem de já ter sido adicionado à empresa
  const companyModule = await companyModuleRepository.findByCompanyAndModule(
    companyId,
    moduleId,
  );

  if (!companyModule) {
    throw new NotFoundException('Este módulo não está adicionado à empresa');
  }

  // 3. Um módulo retirado do catálogo não pode voltar a ser ligado
  if (dto.isActive && !companyModule.module.isActive) {
    throw new BadRequestException('Este módulo já não está disponível');
  }

  return companyModuleRepository.setActive(companyModule.id, dto.isActive);
}

import { BadRequestException, ConflictException } from '@nestjs/common';
import { PrismaCompanyModuleRepository } from '../repositories/prisma/prisma-company-module-repository';
import { PrismaCompanyRepository } from 'src/company/repositories/prisma/prisma-company-repository';
import { PrismaModuleRepository } from 'src/module/repositories/prisma/prisma-module-repository';
import { assertCompanyOwnership } from './assertCompanyOwnership';
import { ActivateCompanyModuleDto } from '../dto/activate-company-module.dto';

export async function activateCompanyModule(
  userId: string,
  companyId: string,
  dto: ActivateCompanyModuleDto,
  companyModuleRepository: PrismaCompanyModuleRepository,
  companyRepository: PrismaCompanyRepository,
  moduleRepository: PrismaModuleRepository,
) {
  // 1. A empresa tem de existir e ser de quem está a pedir
  await assertCompanyOwnership(userId, companyId, companyRepository, 'modules.edit');

  // 2. O módulo tem de existir e estar disponível no catálogo
  const module = await moduleRepository.findById(dto.moduleId);

  if (!module) {
    throw new BadRequestException('Módulo inválido');
  }

  if (!module.isActive) {
    throw new BadRequestException('Este módulo não está disponível');
  }

  // 3. Já ativado antes? Aqui não se reativa — isso é o PATCH
  const existing = await companyModuleRepository.findByCompanyAndModule(
    companyId,
    dto.moduleId,
  );

  if (existing) {
    throw new ConflictException('Este módulo já foi adicionado à empresa');
  }

  return companyModuleRepository.create({ companyId, moduleId: dto.moduleId });
}

import { ConflictException } from '@nestjs/common';
import { PrismaModuleRepository } from '../repositories/prisma/prisma-module-repository';
import { CreateModuleDto } from '../dto/create-module.dto';

export async function createModule(dto: CreateModuleDto, moduleRepository: PrismaModuleRepository) {
  const existing = await moduleRepository.findByName(dto.name);

  if (existing) {
    throw new ConflictException('Já existe um módulo com este nome');
  }

  return moduleRepository.create(dto);
}

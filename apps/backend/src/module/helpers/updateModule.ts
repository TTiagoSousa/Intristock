import { ConflictException, NotFoundException } from '@nestjs/common';
import { PrismaModuleRepository } from '../repositories/prisma/prisma-module-repository';
import { UpdateModuleDto } from '../dto/update-module.dto';

export async function updateModule(
  id: string,
  dto: UpdateModuleDto,
  moduleRepository: PrismaModuleRepository,
) {
  const module = await moduleRepository.findById(id);

  if (!module) {
    throw new NotFoundException('Módulo não encontrado');
  }

  // Renomear para um nome já usado por outro módulo
  if (dto.name && dto.name !== module.name) {
    const existing = await moduleRepository.findByName(dto.name);

    if (existing) {
      throw new ConflictException('Já existe um módulo com este nome');
    }
  }

  return moduleRepository.update(id, dto);
}

import { Injectable } from '@nestjs/common';
import { PrismaModuleRepository } from './repositories/prisma/prisma-module-repository';
import { createModule } from './helpers/createModule';
import { updateModule } from './helpers/updateModule';
import { findAllModules } from './helpers/findAllModules';
import { CreateModuleDto } from './dto/create-module.dto';
import { UpdateModuleDto } from './dto/update-module.dto';

@Injectable()
export class ModuleService {
  constructor(private readonly moduleRepository: PrismaModuleRepository) {}

  async create(dto: CreateModuleDto) {
    return createModule(dto, this.moduleRepository);
  }

  async update(id: string, dto: UpdateModuleDto) {
    return updateModule(id, dto, this.moduleRepository);
  }

  async findAll(includeInactive: boolean) {
    return findAllModules(includeInactive, this.moduleRepository);
  }
}

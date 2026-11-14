import { Module } from '@nestjs/common';
import { ModuleService } from './module.service';
import { ModuleController } from './module.controller';
import { PrismaModuleRepository } from './repositories/prisma/prisma-module-repository';

// Catálogo de módulos do sistema
@Module({
  controllers: [ModuleController],
  providers: [
    ModuleService,
    {
      provide: PrismaModuleRepository,
      useClass: PrismaModuleRepository,
    },
  ],
  exports: [PrismaModuleRepository],
})
export class SystemModuleModule {}

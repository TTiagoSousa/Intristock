import { PrismaModuleRepository } from '../repositories/prisma/prisma-module-repository';

// O Admin precisa de ver todos (para reativar os desligados); quem consome a
// app só deve ver os que estão disponíveis
export async function findAllModules(
  includeInactive: boolean,
  moduleRepository: PrismaModuleRepository,
) {
  if (includeInactive) {
    return moduleRepository.findAll();
  }

  return moduleRepository.findAllActive();
}

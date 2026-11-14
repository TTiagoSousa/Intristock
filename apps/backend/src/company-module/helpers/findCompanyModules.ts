import { PrismaCompanyModuleRepository } from '../repositories/prisma/prisma-company-module-repository';
import { PrismaCompanyRepository } from 'src/company/repositories/prisma/prisma-company-repository';
import { assertCompanyOwnership } from './assertCompanyOwnership';

export async function findCompanyModules(
  userId: string,
  companyId: string,
  companyModuleRepository: PrismaCompanyModuleRepository,
  companyRepository: PrismaCompanyRepository,
) {
  await assertCompanyOwnership(userId, companyId, companyRepository, 'member');

  // Devolve os adicionados, ligados ou desligados — quem decide o que mostrar
  // no menu é o frontend, filtrando por isActive
  return companyModuleRepository.findAllByCompanyId(companyId);
}

import { PrismaCompanyRepository } from '../repositories/prisma/prisma-company-repository';
import { UpdateCompanyStatusDto } from '../dto/update-company-status.dto';
import { assertCompanyAccess } from './assertCompanyAccess';

/**
 * Parar e voltar a pôr a trabalhar.
 *
 * Uma empresa parada continua à vista e abre-se toda — o que ela deixa de
 * aceitar são registos novos. É por isso que isto **não** é uma escrita para
 * efeitos do guarda: se fosse, uma empresa desativada não se conseguia reativar.
 */
export async function updateCompanyStatus(
  userId: string,
  companyId: string,
  dto: UpdateCompanyStatusDto,
  companyRepository: PrismaCompanyRepository,
) {
  await assertCompanyAccess(userId, companyId, companyRepository, {
    notYours: 'Não podes mudar o estado de uma empresa que não é tua',
    permission: 'owner',
  });

  return companyRepository.update(companyId, { status: dto.status });
}

import { PrismaCompanyRepository } from '../repositories/prisma/prisma-company-repository';
import { assertCompanyAccess } from './assertCompanyAccess';

/**
 * Apagar sem apagar.
 *
 * A empresa sai da lista e das rotas como se não existisse, mas fica toda cá —
 * pagamentos, ativos, stock, documentos. É a única forma de um clique errado
 * não levar anos de contabilidade atrás.
 *
 * Repô-la não é coisa que o dono faça sozinho: tem de pedir ao suporte. Isso é
 * de propósito — é o que separa "apagar" de "desativar", que se liga e desliga
 * à vontade.
 */
export async function deleteCompany(
  userId: string,
  companyId: string,
  companyRepository: PrismaCompanyRepository,
) {
  // Não é `write`: uma empresa desativada também se pode apagar
  await assertCompanyAccess(userId, companyId, companyRepository, {
    notYours: 'Não podes apagar uma empresa que não é tua',
    permission: 'owner',
  });

  await companyRepository.update(companyId, {
    status: 'deleted',
    deletedAt: new Date(),
  });
}

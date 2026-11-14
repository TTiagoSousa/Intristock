import { NotFoundException } from '@nestjs/common';
import { assertCompanyAccess } from 'src/company/helpers/assertCompanyAccess';
import { PrismaCompanyRepository } from 'src/company/repositories/prisma/prisma-company-repository';
import { PrismaCompanyItemRepository } from '../repositories/prisma/prisma-company-item-repository';
import { planItemName } from './planItemName';

/**
 * Os planos ativos de uma plataforma do catálogo (numa prop firm, os desafios),
 * para os juntar como itens, com o item desta empresa que já veio de cada um.
 */
export async function findPlatformPlansForItems(
  userId: string,
  companyId: string,
  platformId: string,
  itemRepository: PrismaCompanyItemRepository,
  companyRepository: PrismaCompanyRepository,
) {
  await assertCompanyAccess(userId, companyId, companyRepository, {
    notYours: 'Não podes ver o catálogo de uma empresa que não é tua',
    permission: 'items.create',
  });

  const platform = await itemRepository.findCatalogPlatform(platformId);
  if (!platform || !platform.isActive)
    throw new NotFoundException('Fornecedor do catálogo não encontrado');

  const linked = await itemRepository.findPlanLinks(
    companyId,
    platform.plans.map((plan) => plan.id),
  );
  const itemOf = new Map(linked.map((item) => [item.platformPlanId, item]));

  return {
    platform: { id: platform.id, name: platform.name, logo: platform.logo },
    plans: platform.plans.map((plan) => ({
      id: plan.id,
      name: planItemName(platform.name, plan),
      step: plan.step,
      accountSize: plan.accountSize != null ? Number(plan.accountSize) : null,
      price: plan.price != null ? Number(plan.price) : null,
      currency: plan.currency,
      item: itemOf.has(plan.id)
        ? { id: itemOf.get(plan.id)!.id, slug: itemOf.get(plan.id)!.slug }
        : null,
    })),
  };
}

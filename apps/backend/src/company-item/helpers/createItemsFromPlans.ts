import { BadRequestException } from '@nestjs/common';
import { assertCompanyAccess } from 'src/company/helpers/assertCompanyAccess';
import { PrismaCompanyRepository } from 'src/company/repositories/prisma/prisma-company-repository';
import { PrismaCompanySupplierRepository } from 'src/company-supplier/repositories/prisma/prisma-company-supplier-repository';
import { createSupplierFromPlatform } from 'src/company-supplier/helpers/createSupplierFromPlatform';
import { PrismaCurrencyRepository } from 'src/currency/repositories/prisma/prisma-currency-repository';
import { CurrencyService } from 'src/currency/currency.service';
import { slugify } from 'src/company/helpers/generateCompanySlug';
import { PrismaCompanyItemRepository } from '../repositories/prisma/prisma-company-item-repository';
import { planItemName } from './planItemName';

// O URL da página de criar: um item não pode ficar com este slug
const RESERVED_SLUGS = new Set(['new-item']);

/**
 * Junta planos de uma plataforma do catálogo como itens da empresa: um serviço
 * que se gasta (`expense`), com o preço do plano na moeda da empresa à cotação de
 * hoje (o original na descrição), ligado ao fornecedor dessa plataforma, que se
 * cria se ainda não existir. Os planos que a empresa já tem ficam de fora.
 * Os itens gravam-se todos numa transação.
 */
export async function createItemsFromPlans(
  userId: string,
  companyId: string,
  platformId: string,
  planIds: string[],
  itemRepository: PrismaCompanyItemRepository,
  companyRepository: PrismaCompanyRepository,
  supplierRepository: PrismaCompanySupplierRepository,
  currencyRepository: PrismaCurrencyRepository,
  currencyService: CurrencyService,
) {
  const company = await assertCompanyAccess(
    userId,
    companyId,
    companyRepository,
    {
      notYours: 'Não podes criar itens numa empresa que não é tua',
      permission: 'items.create',
    },
  );

  const platform = await itemRepository.findCatalogPlatform(platformId);
  if (!platform || !platform.isActive)
    throw new BadRequestException('Fornecedor do catálogo inválido');

  const wanted = new Set(planIds);
  const plans = platform.plans.filter((plan) => wanted.has(plan.id));
  if (plans.length !== wanted.size)
    throw new BadRequestException('Há planos que não são desta plataforma');

  const already = new Set(
    (await itemRepository.findPlanLinks(companyId, [...wanted])).map(
      (item) => item.platformPlanId,
    ),
  );
  const fresh = plans.filter((plan) => !already.has(plan.id));
  if (!fresh.length) return { created: 0, skipped: plans.length };

  // O fornecedor da plataforma nesta empresa (o helper dele pede suppliers.create)
  const supplier =
    (await supplierRepository.findByPlatform(companyId, platform.id)) ??
    (await createSupplierFromPlatform(
      userId,
      companyId,
      platform.id,
      supplierRepository,
      companyRepository,
    ));

  // O preço na moeda da empresa, à cotação de hoje
  const target = await currencyRepository.findById(company.currencyId);
  const codes = [
    ...new Set(fresh.map((plan) => plan.currency).filter(Boolean)),
  ];
  const sources = new Map(
    (
      await Promise.all(
        codes.map((code) => currencyRepository.findByShortCode(code!)),
      )
    )
      .filter((currency) => currency !== null)
      .map((currency) => [currency.shortCode, currency]),
  );
  const converter = await currencyService.converter(
    target,
    [...sources.values()].map((currency) => ({ currency })),
  );
  const priceOf = (price: number | null, code: string | null) => {
    if (price == null) return null;
    if (!code || code === target?.shortCode) return price;
    const source = sources.get(code);
    return source
      ? Math.round(converter.convert(price, source) * 100) / 100
      : null;
  };

  // Nomes e slugs únicos na empresa, também entre os que entram agora
  const names = new Set(await itemRepository.findNames(companyId));
  const slugs = new Set(await itemRepository.findSlugs(companyId));
  const unique = (base: string, taken: Set<string>, join: string) => {
    let candidate = base;
    for (let n = 2; taken.has(candidate) || RESERVED_SLUGS.has(candidate); n++)
      candidate = `${base}${join}${n}`;
    taken.add(candidate);
    return candidate;
  };

  const items = fresh.map((plan) => {
    const name = unique(planItemName(platform.name, plan), names, ' ');
    const price = plan.price != null ? Number(plan.price) : null;
    return {
      companyId,
      platformPlanId: plan.id,
      name,
      slug: unique(slugify(name) || 'item', slugs, '-'),
      type: 'service',
      kind: 'expense',
      isRecurring: false,
      defaultPrice: priceOf(price, plan.currency),
      description:
        price != null
          ? `${price.toLocaleString('pt-PT')} ${plan.currency ?? ''} na ${platform.source === 'propfirmmap' ? 'PropFirmMap' : platform.name}`.replace(
              '  ',
              ' ',
            )
          : null,
      supplierId: supplier.id,
    };
  });

  await itemRepository.createManyFromPlans(items);
  return { created: items.length, skipped: plans.length - items.length };
}

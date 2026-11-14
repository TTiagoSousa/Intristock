import { assertCompanyAccess } from 'src/company/helpers/assertCompanyAccess';
import { PrismaCompanyRepository } from 'src/company/repositories/prisma/prisma-company-repository';
import { PrismaCompanySupplierRepository } from '../repositories/prisma/prisma-company-supplier-repository';

/**
 * O catálogo de fornecedores de uma categoria (as plataformas ativas desse
 * tipo), com o fornecedor desta empresa que já veio de cada uma, se houver.
 */
export async function findSupplierCatalog(
  userId: string,
  companyId: string,
  type: string,
  companySupplierRepository: PrismaCompanySupplierRepository,
  companyRepository: PrismaCompanyRepository,
) {
  await assertCompanyAccess(userId, companyId, companyRepository, {
    notYours: 'Não podes ver o catálogo de uma empresa que não é tua',
    // Os itens também escolhem a firma por aqui (os planos dela viram itens)
    permission: ['suppliers.create', 'items.create'],
  });

  const [platforms, linked] = await Promise.all([
    companySupplierRepository.findCatalogPlatforms(type),
    companySupplierRepository.findPlatformLinks(companyId),
  ]);
  const supplierOf = new Map(linked.map((s) => [s.platformId, s]));

  return platforms.map((platform) => ({
    id: platform.id,
    name: platform.name,
    logo: platform.logo,
    website: platform.website,
    // O país da base ou, se não o encontrámos, como a API o escreve
    country: platform.country?.name ?? platform.propFirm?.countryName ?? null,
    score:
      platform.propFirm?.score != null ? Number(platform.propFirm.score) : null,
    supplier: supplierOf.has(platform.id)
      ? {
          id: supplierOf.get(platform.id)!.id,
          slug: supplierOf.get(platform.id)!.slug,
        }
      : null,
  }));
}

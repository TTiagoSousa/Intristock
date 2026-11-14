import { slugify } from 'src/company/helpers/generateCompanySlug';
import { PrismaCompanySupplierRepository } from '../repositories/prisma/prisma-company-supplier-repository';

// O URL da página de criar — um fornecedor não pode ficar com este slug
const RESERVED_SLUGS = new Set(['new-supplier']);

// O slug é único dentro da empresa (é o que aparece no URL da página do
// fornecedor), por isso um nome repetido leva contador: "iq-capital", "iq-capital-2"
export async function generateSupplierSlug(
  companyId: string,
  name: string,
  companySupplierRepository: PrismaCompanySupplierRepository,
  // O fornecedor que está a mudar de nome, para não esbarrar no slug que já tem
  excludeId?: string,
): Promise<string> {
  const base = slugify(name) || 'fornecedor';

  let candidate = base;
  let counter = 2;

  const isTaken = async (slug: string) => {
    if (RESERVED_SLUGS.has(slug)) return true;
    const existing = await companySupplierRepository.findBySlug(
      companyId,
      slug,
    );
    return Boolean(existing && existing.id !== excludeId);
  };

  while (await isTaken(candidate)) {
    candidate = `${base}-${counter}`;
    counter++;
  }

  return candidate;
}

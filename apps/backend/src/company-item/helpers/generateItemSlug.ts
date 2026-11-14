import { slugify } from 'src/company/helpers/generateCompanySlug';
import { PrismaCompanyItemRepository } from '../repositories/prisma/prisma-company-item-repository';

// O URL da página de criar — um item não pode ficar com este slug
const RESERVED_SLUGS = new Set(['new-item']);

// O slug é único dentro da empresa (é o que aparece no URL da página do item).
// O nome também é, mas dois nomes podem dar o mesmo slug ("PLA 1.75" e
// "PLA-1-75") — o segundo leva contador.
export async function generateItemSlug(
  companyId: string,
  name: string,
  itemRepository: PrismaCompanyItemRepository,
  // O item que está a mudar de nome, para não esbarrar no slug que já tem
  excludeId?: string,
): Promise<string> {
  const base = slugify(name) || 'item';

  let candidate = base;
  let counter = 2;

  const isTaken = async (slug: string) => {
    if (RESERVED_SLUGS.has(slug)) return true;
    const existing = await itemRepository.findBySlug(companyId, slug);
    return Boolean(existing && existing.id !== excludeId);
  };

  while (await isTaken(candidate)) {
    candidate = `${base}-${counter}`;
    counter++;
  }

  return candidate;
}

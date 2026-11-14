import { PrismaCompanyRepository } from '../repositories/prisma/prisma-company-repository';

// "Intri Stock, Lda." -> "intri-stock-lda"
export function slugify(value: string): string {
  return value
    .normalize('NFD')
    .replace(/[̀-ͯ]/g, '') // tira acentos
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, '-')
    .replace(/^-+|-+$/g, '');
}

// O slug é único a nível global (é o que aparece no URL), por isso quando o nome
// já está tomado acrescenta-se um contador: "intristock", "intristock-2", ...
export async function generateCompanySlug(
  name: string,
  companyRepository: PrismaCompanyRepository,
  // A empresa que está a mudar de nome. Sem isto, um nome que gere o slug que
  // ela já tem esbarrava consigo própria e saía "intristock-2".
  excludeId?: string,
): Promise<string> {
  const base = slugify(name) || 'empresa';

  let candidate = base;
  let counter = 2;

  let taken = await companyRepository.findBySlug(candidate);

  while (taken && taken.id !== excludeId) {
    candidate = `${base}-${counter}`;
    counter++;
    taken = await companyRepository.findBySlug(candidate);
  }

  return candidate;
}

import { ForbiddenException } from '@nestjs/common';
import { CompanyAccess } from './getMyCompanyAccess';

/**
 * Quem gere cargos e membros só dá o que também tem: sem isto, um membro com
 * "gerir membros" dava-se a si próprio (ou a um colega) a empresa inteira.
 * O dono dá tudo.
 */
export function assertCanGrant(access: CompanyAccess, permissions: string[]) {
  if (access.owner) return;
  const own = new Set<string>(access.permissions);
  const missing = permissions.filter((p) => !own.has(p));
  if (missing.length > 0) {
    throw new ForbiddenException(`Não podes dar permissões que tu próprio não tens (${missing.join(', ')})`);
  }
}

import { BadRequestException } from '@nestjs/common';

/**
 * O perfil de volume (o indicador `svp` e os valores `kind: 'profile'`) saiu do
 * formulário: ainda é cedo para ele. As simulações que já o têm abrem e
 * desenham-se, mas não se criam novas com ele (nem testes ao vivo nem outros
 * mercados a partir delas). Percorre a estratégia toda (indicadores, condições,
 * preços e regras).
 */
export function assertNoProfile(strategy: unknown) {
  const walk = (value: unknown): boolean => {
    if (Array.isArray(value)) return value.some(walk);
    if (!value || typeof value !== 'object') return false;
    const item = value as Record<string, unknown>;
    if (item.kind === 'profile' || item.kind === 'svp') return true;
    return Object.values(item).some(walk);
  };
  if (walk(strategy)) {
    throw new BadRequestException(
      'O perfil de volume já não está disponível nas estratégias: tira-o dos indicadores e das condições',
    );
  }
}

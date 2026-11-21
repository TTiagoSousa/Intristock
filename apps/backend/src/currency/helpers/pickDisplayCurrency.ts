// Sem moeda pedida nem registos, conta-se nesta
export const FALLBACK_DISPLAY_CURRENCY = 'EUR';

/** O que é preciso do repositório de cada área para achar uma moeda. */
export interface DisplayCurrencyLookup<C> {
  findCurrency(currencyId: string): Promise<C | null>;
  findCurrencyByCode(shortCode: string): Promise<C | null>;
}

/**
 * A moeda em que um dashboard ou uma lista mostra os valores: a pedida (se existir),
 * senão a mais usada nos registos (`recordCurrencyIds`, um id por registo; num
 * empate, a que aparece primeiro), senão o euro.
 */
export async function pickDisplayCurrency<C>(
  requestedId: string | null | undefined,
  recordCurrencyIds: readonly string[],
  repository: DisplayCurrencyLookup<C>,
): Promise<C | null> {
  const requested = requestedId
    ? await repository.findCurrency(requestedId)
    : null;
  if (requested) return requested;

  const uses = new Map<string, number>();
  for (const id of recordCurrencyIds) uses.set(id, (uses.get(id) ?? 0) + 1);
  const top = [...uses.entries()].sort((a, b) => b[1] - a[1])[0];
  return top
    ? repository.findCurrency(top[0])
    : repository.findCurrencyByCode(FALLBACK_DISPLAY_CURRENCY);
}

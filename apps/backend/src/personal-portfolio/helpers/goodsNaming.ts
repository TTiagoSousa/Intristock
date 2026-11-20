/** O nome de um bem: o escrito, ou a marca, o modelo e a versão ("Casal Boss 2V"). */
export const goodsName = (details: { brand: string; model: string; version?: string }, name?: string) =>
  name?.trim() || [details.brand, details.model, details.version].map((part) => part?.trim()).filter(Boolean).join(' ');

/** A pesquisa de preços por omissão: a marca e o modelo, sem a versão (apanha mais anúncios). */
export const defaultSearchQuery = (details: { brand: string; model: string }) => `${details.brand.trim()} ${details.model.trim()}`;

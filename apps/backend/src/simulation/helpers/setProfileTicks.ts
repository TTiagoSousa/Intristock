// As casas decimais do preço pelo passo da corretora ("0.01000000" → 2), como o gráfico
const precisionOf = (tickSize: unknown) => {
  const step = Number(tickSize);
  if (!step || step >= 1) return 2;
  return Math.min(8, Math.max(0, Math.round(-Math.log10(step))));
};

/**
 * Põe em cada valor do perfil de volume (`kind: 'profile'`) o tick do mercado,
 * para os "ticks por linha" darem as mesmas linhas que o gráfico desenha: a
 * trading-chart conta o tick pelas casas decimais do preço (10^-casas). Mexe no
 * que recebe (as entradas do pedido ou a estratégia copiada para outro mercado).
 */
export function setProfileTicks(node: unknown, metadata: unknown) {
  const tick = Math.pow(
    10,
    -precisionOf((metadata as Record<string, unknown> | null)?.tickSize),
  );
  const walk = (value: unknown) => {
    if (Array.isArray(value)) {
      value.forEach(walk);
      return;
    }
    if (!value || typeof value !== 'object') return;
    const item = value as Record<string, unknown>;
    if (item.kind === 'profile') item.tickSize = tick;
    Object.values(item).forEach(walk);
  };
  walk(node);
}

// O nome de um item feito de um plano: a firma, o tamanho da conta e a fase
// ("FTMO · 100 000 USD · 2-Step"); o que faltar fica de fora
export function planItemName(
  firm: string,
  plan: {
    name: string | null;
    step: string | null;
    accountSize: unknown;
    currency: string | null;
  },
) {
  const size =
    plan.accountSize != null
      ? `${Number(plan.accountSize).toLocaleString('pt-PT')}${plan.currency ? ` ${plan.currency}` : ''}`
      : null;
  return [firm, size, plan.step ?? plan.name].filter(Boolean).join(' · ');
}

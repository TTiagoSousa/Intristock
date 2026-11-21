/** A descrição do ganho de um pagamento das horas: só as horas (quem paga é a fonte, a empresa). */
export function payoutIncomeDescription(seconds: number) {
  return `Banco de horas · ${Math.round(seconds / 36) / 100} h`;
}

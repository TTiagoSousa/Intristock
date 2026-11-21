/**
 * Quem responde a uma proposta de salário: o membro a quem se paga ou, se foi o próprio membro a
 * propor o seu salário (quem gere os salários a pagar-se a si mesmo), o dono da empresa.
 */
export function payProposalResponder(pay: {
  proposedById: string | null;
  member: { userId: string | null; company: { createdById: string } };
}) {
  const selfProposed = pay.proposedById !== null && pay.proposedById === pay.member.userId;
  return selfProposed ? pay.member.company.createdById : pay.member.userId;
}

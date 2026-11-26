// A hora de uma transação: a que se escreve à mão (opcional) e a das corretoras (`externalAt`)

/** A data e a hora do formulário (na hora local do browser) num instante ISO; sem hora, nulo. */
export const instantOf = (date: string, time: string) => {
  if (!date || !time) return null;
  const at = new Date(`${date}T${time}`);
  return Number.isNaN(at.getTime()) ? null : at.toISOString();
};

/** A hora de uma transação para mostrar (14:32), na hora local; sem instante, nulo. */
export const timeOf = (tx: { externalAt: string | null }, locale: string) =>
  tx.externalAt ? new Date(tx.externalAt).toLocaleTimeString(locale, { hour: '2-digit', minute: '2-digit' }) : null;

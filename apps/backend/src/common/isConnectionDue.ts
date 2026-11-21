// Folga para a volta não escorregar: o serviço vê de 5 em 5 min, por isso uma ligação de
// hora a hora sincronizada às 10h02 entra às 11h00 e não às 11h05
const SLACK_MS = 5 * 60 * 1000;

/** Se uma ligação já passou o intervalo dela desde a última sincronização (nunca = já). */
export function isConnectionDue(
  connection: { syncedAt: Date | null; syncEveryHours: number },
  now: Date,
): boolean {
  if (!connection.syncedAt) return true;
  const every = connection.syncEveryHours * 60 * 60 * 1000 - SLACK_MS;
  return now.getTime() - connection.syncedAt.getTime() >= every;
}

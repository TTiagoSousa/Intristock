import { PrismaRetentionRepository } from '../repositories/prisma/prisma-retention-repository';

// Os avisos lidos ficam 90 dias
export const NOTIFICATION_KEEP_DAYS = 90;
// Quantos de cada vez
const BATCH = 5000;
const DAY_MS = 86_400_000;

/**
 * Apaga os avisos lidos com mais de 90 dias. Os por ler ficam, e os que pedem resposta
 * (`actionStatus` pending: um convite, uma proposta) também, mesmo lidos. Devolve quantos.
 */
export async function deleteOldNotifications(repository: PrismaRetentionRepository, now = new Date()) {
  const before = new Date(now.getTime() - NOTIFICATION_KEEP_DAYS * DAY_MS);
  let total = 0;
  for (;;) {
    const deleted = await repository.deleteReadNotifications(before, BATCH);
    total += deleted;
    if (deleted < BATCH) return total;
  }
}

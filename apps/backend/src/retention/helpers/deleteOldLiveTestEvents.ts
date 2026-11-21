import { PrismaRetentionRepository } from '../repositories/prisma/prisma-retention-repository';

// Os registos de cada condição (uma linha cada vez que uma muda: são a maior parte) ficam 30 dias
export const LIVE_EVENT_KEEP_DAYS = 30;
const PRUNED_KINDS = ['condition'];
// Só dos testes que já acabaram (num a correr, o simulador e o ecrã ainda os leem)
const ENDED_STATUSES = ['stopped', 'finished', 'failed'];
// Quantos de cada vez
const BATCH = 10_000;
const DAY_MS = 86_400_000;

/**
 * Apaga os registos `condition` com mais de 30 dias (pelo `time`, o instante no mercado)
 * dos testes ao vivo parados, acabados ou falhados. Os outros registos (sinais, ordens,
 * posições, o retrato inicial das condições) ficam. Devolve quantos.
 */
export async function deleteOldLiveTestEvents(repository: PrismaRetentionRepository, now = new Date()) {
  const before = new Date(now.getTime() - LIVE_EVENT_KEEP_DAYS * DAY_MS);
  let total = 0;
  for (;;) {
    const deleted = await repository.deleteLiveTestEvents(PRUNED_KINDS, ENDED_STATUSES, before, BATCH);
    total += deleted;
    if (deleted < BATCH) return total;
  }
}

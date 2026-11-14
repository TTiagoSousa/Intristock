import { PrismaLiveTestRepository } from '../repositories/prisma/prisma-live-test-repository';
import { findLiveTest } from './findLiveTest';
import { isActive } from './liveTestStatus';

/**
 * Manda parar um teste: fica `stopping` e o simulador fecha-o (as posições
 * abertas saem como no fim de uma simulação) e passa-o a `stopped`. Um que já
 * acabou fica como está.
 */
export async function stopLiveTest(
  userId: string,
  id: string,
  repository: PrismaLiveTestRepository,
) {
  const test = await findLiveTest(userId, id, repository);
  if (isActive(test.status) && test.status !== 'stopping') {
    await repository.setStatus(id, 'stopping');
    await repository.notify('live_test', id);
  }
  return findLiveTest(userId, id, repository);
}

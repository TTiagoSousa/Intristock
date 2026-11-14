import { BadRequestException } from '@nestjs/common';
import { PrismaSimulationRepository } from '../repositories/prisma/prisma-simulation-repository';
import { MAX_ACTIVE_RUNS } from './runStatus';

/**
 * Recusa pôr mais simulações na fila se o utilizador passar a ter mais de
 * `MAX_ACTIVE_RUNS` na fila, a correr ou a cancelar. `adding` são as que se
 * querem criar de uma vez (os outros mercados criam várias).
 */
export async function assertRunQueue(
  userId: string,
  adding: number,
  repository: PrismaSimulationRepository,
) {
  const active = await repository.countActiveRuns(userId);
  if (active + adding > MAX_ACTIVE_RUNS) {
    throw new BadRequestException(
      `Só podes ter ${MAX_ACTIVE_RUNS} simulações na fila ou a correr ao mesmo tempo (tens ${active}): espera que acabem ou cancela alguma`,
    );
  }
}

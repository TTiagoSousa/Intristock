import { BadRequestException, NotFoundException } from '@nestjs/common';
import { PrismaSimulationRepository } from '../repositories/prisma/prisma-simulation-repository';

/**
 * Cancela uma simulação: na fila passa logo a `cancelled`; a correr fica
 * `cancelling` e o simulador, que vê o estado a cada poucos segundos, para-a e
 * passa-a a `cancelled`. O estado só muda se ainda for o que se leu (o
 * simulador pode tê-la apanhado entretanto). Devolve o estado novo.
 */
export async function cancelSimulation(
  userId: string,
  id: string,
  repository: PrismaSimulationRepository,
) {
  const run = await repository.findRunStatus(id, userId);
  if (!run) throw new NotFoundException('Simulação não encontrada');

  if (run.status === 'queued') {
    if (await repository.cancelQueuedRun(id)) return { status: 'cancelled' };
  } else if (run.status === 'running') {
    if (await repository.cancelRunningRun(id)) return { status: 'cancelling' };
  } else if (run.status === 'cancelling') {
    return { status: 'cancelling' };
  } else {
    throw new BadRequestException(
      'Esta simulação já acabou: só se cancela uma na fila ou a correr',
    );
  }

  // Mudou entre a leitura e a escrita (passou a correr ou acabou): tenta outra vez
  const current = await repository.findRunStatus(id, userId);
  if (current?.status === 'running' && (await repository.cancelRunningRun(id)))
    return { status: 'cancelling' };
  if (current?.status === 'cancelling' || current?.status === 'cancelled')
    return { status: current.status };
  throw new BadRequestException(
    'Esta simulação já acabou: só se cancela uma na fila ou a correr',
  );
}

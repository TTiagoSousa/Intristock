import { BadRequestException, NotFoundException } from '@nestjs/common';
import { PrismaSimulationRepository } from '../repositories/prisma/prisma-simulation-repository';

/**
 * Apaga simulações do utilizador, com os trades e o pedido de velas de cada
 * uma (as velas ficam no ClickHouse para as próximas). Uma a correr não se
 * apaga: o simulador ia gravar o resultado numa simulação que já não existe.
 * As corridas noutros mercados de uma apagada ficam soltas (`sourceRunId` nulo).
 */
export async function deleteSimulations(
  userId: string,
  ids: string[],
  repository: PrismaSimulationRepository,
) {
  const unique = [...new Set(ids)];
  const runs = await repository.findRunsToDelete(unique, userId);
  if (runs.length !== unique.length)
    throw new NotFoundException('Simulação não encontrada');
  // A cancelar ainda corre até o simulador a parar; uma cancelada já se apaga
  if (runs.some((run) => ['running', 'cancelling'].includes(run.status))) {
    throw new BadRequestException(
      'Uma das simulações está a correr: espera que acabe para a apagar',
    );
  }

  const deleted = await repository.deleteRuns(
    unique,
    runs.map((run) => run.downloadId),
  );
  return { deleted };
}

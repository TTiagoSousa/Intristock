import { NotFoundException } from '@nestjs/common';
import { PrismaSimulationRepository } from '../repositories/prisma/prisma-simulation-repository';
import { summarizeResult } from './findSimulations';

/**
 * 3.7 — A família de uma simulação: a original e as corridas noutros mercados
 * (a mesma estratégia), com o resumo de cada uma e o veredicto, para a tabela
 * por mercado. A partir de qualquer uma dá sempre a família toda.
 */
export async function findMarketRuns(
  userId: string,
  id: string,
  repository: PrismaSimulationRepository,
) {
  const run = await repository.findRun(id, userId);
  if (!run) throw new NotFoundException('Simulação não encontrada');

  const sourceRunId = run.sourceRunId ?? run.id;
  const items = await repository.findMarketRuns(sourceRunId, userId);
  return {
    sourceRunId,
    items: items.map(({ result, verdicts, ...item }) => ({
      ...item,
      result: summarizeResult(result),
      verdict:
        verdicts && typeof verdicts === 'object'
          ? ((verdicts as Record<string, unknown>).overall as string)
          : null,
    })),
  };
}

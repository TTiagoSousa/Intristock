import { NotFoundException } from '@nestjs/common';
import { PrismaSimulationRepository } from '../repositories/prisma/prisma-simulation-repository';

// Cada utilizador só vê as suas simulações
export async function findSimulation(
  userId: string,
  id: string,
  repository: PrismaSimulationRepository,
) {
  const run = await repository.findRun(id, userId);
  if (!run) throw new NotFoundException('Simulação não encontrada');
  return run;
}

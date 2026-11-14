import { PrismaSimulationRepository } from '../repositories/prisma/prisma-simulation-repository';
import { findSimulation } from './findSimulation';

// Os trades de uma simulação, todos, para o gráfico. As velas não vêm aqui: o
// gráfico pede-as aos blocos (/market/candles), em qualquer tempo gráfico
export async function findSimulationChart(
  userId: string,
  id: string,
  repository: PrismaSimulationRepository,
) {
  const run = await findSimulation(userId, id, repository);
  const trades = await repository.findChartTrades(run.id);
  return { trades };
}

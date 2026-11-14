import { resolvePagination } from 'src/common/pagination';
import { FindTradesQueryDto } from '../dto/find-trades-query.dto';
import { PrismaSimulationRepository } from '../repositories/prisma/prisma-simulation-repository';
import { findSimulation } from './findSimulation';

// Os trades de uma simulação, dez de cada vez e pela ordem de entrada (ou do
// mais recente, com order=desc); se pedido, só os de uma entrada e/ou de uma saída
export async function findSimulationTrades(
  userId: string,
  id: string,
  query: FindTradesQueryDto,
  repository: PrismaSimulationRepository,
) {
  await findSimulation(userId, id, repository);
  const { skip, take } = resolvePagination(query);

  const [exitReason, exitRule] = query.exit?.split(':') ?? [];
  return repository.findTrades(
    id,
    skip,
    take,
    {
      entryRule: query.entryRule,
      exitReason,
      exitRule: exitRule ? Number(exitRule) : undefined,
    },
    query.order ?? 'asc',
  );
}

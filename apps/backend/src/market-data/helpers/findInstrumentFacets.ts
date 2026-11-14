import { PrismaMarketDataRepository } from '../repositories/prisma/prisma-market-data-repository';

// As corretoras e os tipos de mercado, com quantos há de cada,
// para o painel de filtros não oferecer combinações vazias
export async function findInstrumentFacets(
  repository: PrismaMarketDataRepository,
) {
  return repository.countInstrumentFacets('trading');
}

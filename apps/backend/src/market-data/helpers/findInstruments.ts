import { resolvePagination } from 'src/common/pagination';
import { PrismaMarketDataRepository } from '../repositories/prisma/prisma-market-data-repository';
import { FindInstrumentsDto } from '../dto/find-instruments.dto';

// O input de ativos mostra uma lista que rola: 20 de cada vez em vez de 10
const INSTRUMENTS_TAKE = 20;

export async function findInstruments(
  query: FindInstrumentsDto,
  repository: PrismaMarketDataRepository,
) {
  const { skip } = resolvePagination(query);
  const search = query.search?.trim().replace(/[\s/_-]+/g, '');

  return repository.findInstruments(
    {
      search: search || undefined,
      source: query.source?.toLowerCase(),
      type: query.type,
      status: query.status ?? 'trading',
    },
    skip,
    query.take ?? INSTRUMENTS_TAKE,
  );
}

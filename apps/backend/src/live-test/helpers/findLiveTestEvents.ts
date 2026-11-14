import {
  DEFAULT_EVENTS_TAKE,
  FindLiveEventsQueryDto,
} from '../dto/find-live-events-query.dto';
import { PrismaLiveTestRepository } from '../repositories/prisma/prisma-live-test-repository';
import { findLiveTest } from './findLiveTest';

/**
 * Os registos de um teste, dos últimos gravados para trás, às páginas (`before`
 * é o id do último que o ecrã já tem). O id é um BigInt: vai em texto.
 */
export async function findLiveTestEvents(
  userId: string,
  id: string,
  query: FindLiveEventsQueryDto,
  repository: PrismaLiveTestRepository,
) {
  await findLiveTest(userId, id, repository);
  const take = query.take ?? DEFAULT_EVENTS_TAKE;
  const rows = await repository.findEvents(
    id,
    query.before ? BigInt(query.before) : null,
    take + 1,
    query.kinds ?? null,
  );
  return {
    items: rows.slice(0, take).map((row) => ({
      id: row.id.toString(),
      time: row.time.getTime(),
      kind: row.kind,
      data: row.data,
    })),
    noMore: rows.length <= take,
  };
}

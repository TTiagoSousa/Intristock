import { FindLiveTestsQueryDto } from '../dto/find-live-tests-query.dto';
import { PrismaLiveTestRepository } from '../repositories/prisma/prisma-live-test-repository';

// Os testes ao vivo do utilizador (de uma simulação, se vier; só os ativos, com
// `active`), dos mais recentes para trás, cada um com o resumo do estado
export async function findLiveTests(
  userId: string,
  query: FindLiveTestsQueryDto,
  repository: PrismaLiveTestRepository,
) {
  const tests = await repository.findMany(
    userId,
    query.runId,
    query.active ?? false,
  );
  const summaries = await repository.findSummaries(
    tests.map((test) => test.id),
  );
  return tests.map((test) => ({
    ...test,
    summary: summaries.get(test.id) ?? null,
  }));
}

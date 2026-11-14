import { PaginationQueryDto, resolvePagination } from 'src/common/pagination';
import { PrismaSimulationRepository } from '../repositories/prisma/prisma-simulation-repository';

// O que a lista mostra do resumo; o resto do `result` fica para a página da
// simulação
export interface ResultSummary {
  netProfitPct: number;
  trades: number;
  winRate: number | null;
  maxDrawdownPct: number;
  buyHoldPct: number;
}

export const summarizeResult = (result: unknown): ResultSummary | null => {
  if (!result || typeof result !== 'object') return null;
  const value = result as Record<string, unknown>;
  return {
    netProfitPct: value.netProfitPct as number,
    trades: value.trades as number,
    winRate: (value.winRate as number | null) ?? null,
    maxDrawdownPct: value.maxDrawdownPct as number,
    buyHoldPct: value.buyHoldPct as number,
  };
};

// As simulações do utilizador, das mais recentes para as mais antigas
export async function findSimulations(
  userId: string,
  query: PaginationQueryDto,
  repository: PrismaSimulationRepository,
) {
  const { skip, take } = resolvePagination(query);
  const { items, total } = await repository.findRuns(userId, skip, take);

  return {
    items: items.map(({ result, ...run }) => ({
      ...run,
      result: summarizeResult(result),
    })),
    total,
  };
}

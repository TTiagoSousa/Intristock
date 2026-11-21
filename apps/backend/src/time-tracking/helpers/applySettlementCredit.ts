import { PrismaTimeTrackingRepository } from '../repositories/prisma/prisma-time-tracking-repository';
import { allocateSeconds } from './allocateSeconds';
import { DEFAULT_TIMEZONE, startOfLocalDay } from './localDay';

/**
 * Gasta as horas adiantadas (as liquidações por horas que pagaram mais do que havia) nas horas
 * por pagar que entretanto chegaram, das mais antigas, pela ordem em que se pagaram. Corre no
 * fim de cada sincronização, cada liquidação com o cadeado do cliente (o mesmo de quem marca
 * horas como pagas), e o que falta gastar lê-se outra vez lá dentro. Devolve os segundos alocados.
 *
 * O `fromDate` é um dia local; sem o fuso de quem pagou guardado, conta-se no fuso de omissão
 * (Lisboa), o mesmo dos ganhos esperados, e não à meia-noite UTC.
 */
export async function applySettlementCredit(connectionId: string, repository: PrismaTimeTrackingRepository) {
  let total = 0;
  for (const settlement of await repository.findSettlementsWithCredit(connectionId)) {
    const from = settlement.fromDate
      ? startOfLocalDay(settlement.fromDate.toISOString().slice(0, 10), DEFAULT_TIMEZONE)
      : undefined;
    total += await repository.locked(`settle:${settlement.clientId}`, async (tx) => {
      const left = settlement.seconds - (await tx.settlementAllocatedSeconds(settlement.id));
      if (left <= 0) return 0;
      const entries = await tx.findClientEntries(settlement.clientId, settlement.personId, from);
      const { allocations } = allocateSeconds(entries, left);
      if (!allocations.length) return 0;
      await tx.addAllocations(settlement.id, allocations);
      return allocations.reduce((sum, allocation) => sum + allocation.seconds, 0);
    });
  }
  return total;
}

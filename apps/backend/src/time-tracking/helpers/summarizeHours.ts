import { BadRequestException } from '@nestjs/common';
import { PrismaCompanyRepository } from 'src/company/repositories/prisma/prisma-company-repository';
import { PrismaTimeTrackingRepository } from '../repositories/prisma/prisma-time-tracking-repository';
import { HoursQueryDto } from '../dto/time-tracking.dto';
import { assertTimesheetAccess } from './assertTimesheetAccess';
import { entryValue } from './entryValue';
import { localDay, resolveTimezone } from './localDay';

const round = (value: number) => Math.round(value * 100) / 100;
const DAY_MS = 24 * 60 * 60 * 1000;
// Mais do que isto de uma vez é pedir a base toda
const MAX_RANGE_DAYS = 3 * 366;

type Totals = {
  seconds: number;
  billableSeconds: number;
  amount: number;
  paidSeconds: number;
  paidAmount: number;
  unpaidSeconds: number;
  unpaidAmount: number;
  entries: number;
};

const emptyTotals = (): Totals => ({
  seconds: 0,
  billableSeconds: 0,
  amount: 0,
  paidSeconds: 0,
  paidAmount: 0,
  unpaidSeconds: 0,
  unpaidAmount: 0,
  entries: 0,
});

/**
 * As horas de um período (os dias `from` a `to`, inclusive, no fuso pedido): cada cliente em
 * cada mês (`month`, por omissão), em cada dia (`day`) ou só por cliente (`client`), com o
 * valor e o que está pago e por pagar, e os totais. O valor é o preço de cada registo
 * (`entryValue`); o pago, as horas das alocações.
 */
export async function summarizeHours(
  userId: string,
  companyId: string,
  query: HoursQueryDto,
  repository: PrismaTimeTrackingRepository,
  companyRepository: PrismaCompanyRepository,
) {
  await assertTimesheetAccess(userId, companyId, companyRepository, false);
  if (query.from > query.to) throw new BadRequestException('A data de início é depois da de fim');
  const fromDate = new Date(`${query.from}T00:00:00Z`);
  const toDate = new Date(`${query.to}T00:00:00Z`);
  if ((toDate.getTime() - fromDate.getTime()) / DAY_MS > MAX_RANGE_DAYS)
    throw new BadRequestException('O período não pode passar de 3 anos');
  const timeZone = resolveTimezone(query.tz);
  const group = query.group ?? 'month';

  // Um dia de folga de cada lado: os dias contam-se no fuso, não em UTC
  const entries = (
    await repository.findEntries({
      companyId,
      from: new Date(fromDate.getTime() - DAY_MS),
      to: new Date(toDate.getTime() + 2 * DAY_MS),
      connectionId: query.connectionId,
      clientId: query.clientId,
      personId: query.personId,
    })
  )
    .map((entry) => ({ entry, day: localDay(entry.start, timeZone) }))
    .filter(({ day }) => day >= query.from && day <= query.to);

  const rows = new Map<
    string,
    Totals & { period: string | null; client: { id: string; name: string } | null }
  >();
  const totals = emptyTotals();
  const add = (target: Totals, value: ReturnType<typeof entryValue>, billable: boolean) => {
    target.seconds += value.seconds;
    if (billable) target.billableSeconds += value.seconds;
    target.amount += value.amount;
    target.paidSeconds += value.paidSeconds;
    target.paidAmount += value.paidAmount;
    target.unpaidSeconds += value.unpaidSeconds;
    target.unpaidAmount += value.unpaidAmount;
    target.entries += 1;
  };

  for (const { entry, day } of entries) {
    const value = entryValue(entry);
    const period = group === 'month' ? day.slice(0, 7) : group === 'day' ? day : null;
    const key = `${period ?? ''}|${entry.clientId ?? 'none'}`;
    const row = rows.get(key) ?? {
      ...emptyTotals(),
      period,
      client: entry.client ? { id: entry.client.id, name: entry.client.name } : null,
    };
    const billable = value.rate > 0;
    add(row, value, billable);
    add(totals, value, billable);
    rows.set(key, row);
  }

  const finish = <T extends Totals>(row: T): T => ({
    ...row,
    amount: round(row.amount),
    paidAmount: round(row.paidAmount),
    unpaidAmount: round(row.unpaidAmount),
  });

  // A moeda das ligações (as contas não convertem: uma empresa usa uma organização na mesma moeda)
  const connections = await repository.findConnections(companyId);
  const currency =
    connections.find((connection) => connection.id === query.connectionId)?.currency ?? connections[0]?.currency ?? null;

  return {
    currency,
    from: query.from,
    to: query.to,
    group,
    timeZone,
    totals: finish(totals),
    rows: [...rows.values()]
      .map(finish)
      .sort(
        (a, b) =>
          (b.period ?? '').localeCompare(a.period ?? '') ||
          (a.client?.name ?? '').localeCompare(b.client?.name ?? ''),
      ),
  };
}

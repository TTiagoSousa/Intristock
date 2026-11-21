import { PrismaCompanyRepository } from 'src/company/repositories/prisma/prisma-company-repository';
import { PrismaTimeTrackingRepository } from '../repositories/prisma/prisma-time-tracking-repository';
import { EntriesQueryDto } from '../dto/time-tracking.dto';
import { assertTimesheetAccess } from './assertTimesheetAccess';
import { entryValue } from './entryValue';
import { resolveTimezone, startOfLocalDay as startOfDay } from './localDay';

const DAY_MS = 24 * 60 * 60 * 1000;

/** Os registos de um período, às páginas e do mais recente, cada um com o preço e o que está pago. */
export async function findTimeTrackingEntries(
  userId: string,
  companyId: string,
  query: EntriesQueryDto,
  repository: PrismaTimeTrackingRepository,
  companyRepository: PrismaCompanyRepository,
) {
  await assertTimesheetAccess(userId, companyId, companyRepository, false);
  const timeZone = resolveTimezone(query.tz);
  const take = query.take ?? 20;
  const page = query.page ?? 1;
  const from = startOfDay(query.from, timeZone);
  const to = new Date(startOfDay(query.to, timeZone).getTime() + DAY_MS);
  const { rows, total } = await repository.findEntriesPage(
    {
      companyId,
      from,
      to,
      connectionId: query.connectionId,
      clientId: query.clientId,
      personId: query.personId,
    },
    query.status,
    (page - 1) * take,
    take,
  );
  return {
    page,
    take,
    total,
    entries: rows.map((entry) => {
      const value = entryValue(entry);
      return {
        id: entry.id,
        start: entry.start,
        end: entry.end,
        seconds: entry.seconds,
        description: entry.description,
        billable: value.rate > 0,
        client: entry.client ? { id: entry.client.id, name: entry.client.name } : null,
        project: entry.project ? { id: entry.project.id, name: entry.project.name, color: entry.project.color } : null,
        person: entry.person ? { id: entry.person.id, name: entry.person.name } : null,
        rate: value.rate,
        amount: value.amount,
        paidSeconds: value.paidSeconds,
        unpaidAmount: value.unpaidAmount,
        // Pago pela empresa a quem fez as horas
        payoutSeconds: Math.min(entry.payoutSeconds, entry.seconds),
      };
    }),
  };
}

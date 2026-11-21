import { PrismaService } from 'src/prisma/prisma.service';
import { latestRateHour } from './latestRateHour';

const utcDay = (date: Date) => date.toISOString().slice(0, 10);

/**
 * A hora de cotações com que fica um registo das finanças pessoais com esta data: só um
 * registo de hoje (UTC) leva a hora mais recente guardada, e só se ela também for de hoje.
 * Um do passado (ou do futuro) fica sem hora e converte pela cotação do dia dele — senão
 * um ganho de março convertia-se pela cotação de hoje.
 */
export async function rateHourForDate(prisma: PrismaService, date: Date | string | null | undefined) {
  if (!date) return null;
  const today = utcDay(new Date());
  if (utcDay(new Date(date)) !== today) return null;
  const hour = await latestRateHour(prisma);
  return hour && utcDay(hour) === today ? hour : null;
}

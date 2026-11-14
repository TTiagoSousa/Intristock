import { PrismaService } from 'src/prisma/prisma.service';

/**
 * A hora de cotações com que fica um registo das finanças pessoais ao ser
 * gravado: a mais recente que já está guardada (a tarefa de hora a hora enche-a).
 * Não vai à API; sem nenhuma guardada fica nula e o registo converte pela do dia.
 */
export async function latestRateHour(prisma: PrismaService) {
  const row = await prisma.currencyHourRate.findFirst({
    orderBy: { hour: 'desc' },
    select: { hour: true },
  });
  return row?.hour ?? null;
}

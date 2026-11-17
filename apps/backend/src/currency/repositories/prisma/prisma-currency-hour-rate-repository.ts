import { Injectable } from '@nestjs/common';
import { PrismaService } from 'src/prisma/prisma.service';

/** As cotações de hora a hora das moedas do site (unidades por 1 USD). */
@Injectable()
export class PrismaCurrencyHourRateRepository {
  constructor(private readonly prisma: PrismaService) {}

  // A hora mais recente que já está guardada
  async latestHour(): Promise<Date | null> {
    const row = await this.prisma.currencyHourRate.findFirst({
      orderBy: { hour: 'desc' },
      select: { hour: true },
    });
    return row?.hour ?? null;
  }

  async hasHour(hour: Date) {
    return (await this.prisma.currencyHourRate.count({ where: { hour } })) > 0;
  }

  async findMany(hours: Date[], currencyIds: string[]) {
    if (!hours.length || !currencyIds.length) return [];
    return this.prisma.currencyHourRate.findMany({
      where: { hour: { in: hours }, currencyId: { in: currencyIds } },
    });
  }

  // Todas as horas entre `from` (incluída) e `until` (de fora)
  async findBetween(from: Date, until: Date, currencyIds: string[]) {
    if (!currencyIds.length) return [];
    return this.prisma.currencyHourRate.findMany({
      where: {
        hour: { gte: from, lt: until },
        currencyId: { in: currencyIds },
      },
    });
  }

  // Os dias (YYYY-MM-DD) entre os dois que já têm alguma hora guardada
  // Os dias em que todas estas moedas têm pelo menos uma hora (uma moeda nova, como a
  // libra, faz faltar os dias que só têm as outras)
  async daysWithRates(from: Date, until: Date, currencyIds: string[]) {
    const rows = await this.prisma.currencyHourRate.findMany({
      where: { hour: { gte: from, lt: until }, currencyId: { in: currencyIds } },
      select: { hour: true, currencyId: true },
      distinct: ['hour', 'currencyId'],
    });
    const byDay = new Map<string, Set<string>>();
    for (const row of rows) {
      const day = row.hour.toISOString().slice(0, 10);
      byDay.set(day, (byDay.get(day) ?? new Set()).add(row.currencyId));
    }
    return new Set([...byDay].filter(([, ids]) => ids.size >= currencyIds.length).map(([day]) => day));
  }

  // O dia da primeira transação de um portefólio (de quem for): daí para cá
  // tem de haver cotações
  async firstPortfolioDay(): Promise<Date | null> {
    const row = await this.prisma.personalPortfolioTransaction.findFirst({
      orderBy: { date: 'asc' },
      select: { date: true },
    });
    return row?.date ?? null;
  }

  // Uma hora de uma vez; as que já lá estão ficam como estão
  async saveHour(hour: Date, rates: { currencyId: string; rate: number }[]) {
    await this.prisma.currencyHourRate.createMany({
      data: rates.map((row) => ({ hour, ...row })),
      skipDuplicates: true,
    });
  }
}

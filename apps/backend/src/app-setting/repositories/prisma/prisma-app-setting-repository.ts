import { Injectable } from '@nestjs/common';
import { PrismaService } from 'src/prisma/prisma.service';
import { AppSetting } from 'src/generated/prisma/client/client';
import { AppSettingRepository } from '../app-setting-repository';

@Injectable()
export class PrismaAppSettingRepository implements AppSettingRepository {
  constructor(private readonly prisma: PrismaService) {}

  async findMany(keys: string[]): Promise<AppSetting[]> {
    return this.prisma.appSetting.findMany({ where: { key: { in: keys } } });
  }

  async upsertMany(entries: { key: string; value: string; encrypted: boolean }[]): Promise<void> {
    await this.prisma.$transaction(
      entries.map((entry) =>
        this.prisma.appSetting.upsert({
          where: { key: entry.key },
          update: { value: entry.value, encrypted: entry.encrypted },
          create: entry,
        }),
      ),
    );
  }

  async countCatalog(): Promise<{ countries: number; currencies: number }> {
    const [countries, currencies] = await Promise.all([
      this.prisma.country.count(),
      this.prisma.currency.count(),
    ]);
    return { countries, currencies };
  }

  // As cotações gravam-se na moeda: a última que mudou diz quando foi a atualização
  async lastRatesUpdate(): Promise<Date | null> {
    const latest = await this.prisma.currency.aggregate({ _max: { updatedAt: true } });
    return latest._max.updatedAt;
  }
}

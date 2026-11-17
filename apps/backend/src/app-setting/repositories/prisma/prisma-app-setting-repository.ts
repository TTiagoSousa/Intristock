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

  async countCatalog(): Promise<{
    countries: number;
    currencies: number;
    exchanges: number;
    exchangesSyncedAt: string | null;
  }> {
    const [countries, currencies, exchanges] = await Promise.all([
      this.prisma.country.count(),
      this.prisma.currency.count(),
      // As exchanges que a CoinGecko mantém (as do catálogo e as manuais não contam)
      this.prisma.platform.aggregate({
        where: { type: 'exchange', source: 'coingecko', isActive: true },
        _count: { _all: true },
        _max: { syncedAt: true },
      }),
    ]);
    return {
      countries,
      currencies,
      exchanges: exchanges._count._all,
      exchangesSyncedAt: exchanges._max.syncedAt?.toISOString() ?? null,
    };
  }

  // As cotações gravam-se na moeda: a última que mudou diz quando foi a atualização
  async lastRatesUpdate(): Promise<Date | null> {
    const latest = await this.prisma.currency.aggregate({ _max: { updatedAt: true } });
    return latest._max.updatedAt;
  }
}

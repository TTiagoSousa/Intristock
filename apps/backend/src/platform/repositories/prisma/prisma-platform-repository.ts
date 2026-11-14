import { Injectable } from '@nestjs/common';
import { PrismaService } from 'src/prisma/prisma.service';
import { ExternalPlanData, ExternalPlatformData, PlatformRepository } from '../platform-repository';
import { Platform, PlatformPlan, PropFirmDetail } from 'src/generated/prisma/client/client';
import { PropFirmRules, PropFirmSummary } from '../../helpers/mapPropFirm';

@Injectable()
export class PrismaPlatformRepository implements PlatformRepository {
  constructor(private readonly prisma: PrismaService) {}

  async create(data: {
    name: string;
    type: string;
    logo?: string;
    website?: string;
    countryId?: string;
    isActive?: boolean;
  }): Promise<Platform> {
    return this.prisma.platform.create({ data });
  }

  async findAll(): Promise<Platform[]> {
    return this.prisma.platform.findMany({
      where: { isActive: true },
      orderBy: { name: 'asc' },
    });
  }

  async findById(id: string): Promise<Platform | null> {
    return this.prisma.platform.findUnique({ where: { id } });
  }

  async findByType(type: string): Promise<Platform[]> {
    return this.prisma.platform.findMany({ where: { type }, orderBy: { name: 'asc' } });
  }

  async createExternal(data: ExternalPlatformData): Promise<Platform> {
    return this.prisma.platform.create({ data });
  }

  async updateExternal(id: string, data: Partial<ExternalPlatformData>): Promise<Platform> {
    return this.prisma.platform.update({ where: { id }, data });
  }

  async sourceStats(type: string, source: string) {
    const [total, fromSource, plans] = await Promise.all([
      this.prisma.platform.count({ where: { type, isActive: true } }),
      this.prisma.platform.aggregate({
        where: { type, source, isActive: true },
        _count: { _all: true },
        _max: { syncedAt: true },
      }),
      this.prisma.platformPlan.count({ where: { isActive: true, platform: { type, isActive: true } } }),
    ]);
    return { total, fromSource: fromSource._count._all, plans, lastSyncedAt: fromSource._max.syncedAt };
  }

  /**
   * Os planos de uma plataforma como a API os deu: os que já havia (pela chave)
   * atualizam-se, os novos entram e os que saíram ficam inativos — mais tarde
   * pode haver contas a apontar para eles.
   */
  async replacePlans(platformId: string, plans: ExternalPlanData[]): Promise<void> {
    const keys = plans.map((plan) => plan.externalKey);
    await this.prisma.$transaction([
      ...plans.map((plan) =>
        this.prisma.platformPlan.upsert({
          where: { platformId_externalKey: { platformId, externalKey: plan.externalKey } },
          create: { platformId, ...plan, isActive: true },
          update: { ...plan, isActive: true },
        }),
      ),
      this.prisma.platformPlan.updateMany({
        where: { platformId, externalKey: { notIn: keys } },
        data: { isActive: false },
      }),
    ]);
  }

  async findWithPlans(
    id: string,
  ): Promise<(Platform & { plans: PlatformPlan[]; propFirm: PropFirmDetail | null }) | null> {
    return this.prisma.platform.findUnique({
      where: { id },
      include: {
        propFirm: true,
        plans: { where: { isActive: true }, orderBy: [{ step: 'asc' }, { accountSize: 'asc' }] },
      },
    });
  }

  async findByTypeWithPlanCount(type: string) {
    return this.prisma.platform.findMany({
      where: { type },
      orderBy: { name: 'asc' },
      include: { propFirm: true, _count: { select: { plans: { where: { isActive: true } } } } },
    });
  }

  // O resumo de uma prop firm (da lista da API): cria a linha dela ou atualiza-a
  async saveSummary(platformId: string, summary: PropFirmSummary): Promise<void> {
    await this.prisma.propFirmDetail.upsert({
      where: { platformId },
      create: { platformId, ...summary },
      update: summary,
    });
  }

  // As regras e os payouts (da ficha): a linha já existe desde o resumo
  async saveRules(platformId: string, rules: PropFirmRules): Promise<void> {
    await this.prisma.propFirmDetail.update({
      where: { platformId },
      data: { ...rules, detailsSyncedAt: new Date() },
    });
  }
}

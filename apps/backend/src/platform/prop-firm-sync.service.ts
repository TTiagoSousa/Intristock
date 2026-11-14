import { ConflictException, Injectable, Logger } from '@nestjs/common';
import { AppSettingService } from 'src/app-setting/app-setting.service';
import { PrismaCountryRepository } from 'src/country/repositories/prisma/prisma-country-repository';
import { PrismaPlatformRepository } from './repositories/prisma/prisma-platform-repository';
import { PropFirmSyncProgress, syncPropFirms } from './helpers/syncPropFirms';
import { comparePropFirms } from './helpers/comparePropFirms';
import { PROP_FIRM_TYPE, PROPFIRM_SOURCE } from './helpers/mapPropFirm';

interface SyncState {
  running: boolean;
  startedAt: string | null;
  finishedAt: string | null;
  error: string | null;
  progress: PropFirmSyncProgress | null;
}

/**
 * O atualizar das prop firms (PropFirmMap → plataformas). Demora uns 5 minutos
 * (uma ficha por firma, dentro do limite da API), por isso corre em fundo: o
 * pedido só o arranca e o ecrã vai lendo o estado. Um de cada vez.
 */
@Injectable()
export class PropFirmSyncService {
  private readonly logger = new Logger(PropFirmSyncService.name);
  private state: SyncState = {
    running: false,
    startedAt: null,
    finishedAt: null,
    error: null,
    progress: null,
  };

  constructor(
    private readonly appSettingService: AppSettingService,
    private readonly platformRepository: PrismaPlatformRepository,
    private readonly countryRepository: PrismaCountryRepository,
  ) {}

  async status() {
    const stats = await this.platformRepository.sourceStats(
      PROP_FIRM_TYPE,
      PROPFIRM_SOURCE,
    );
    return {
      ...this.state,
      total: stats.total,
      fromApi: stats.fromSource,
      plans: stats.plans,
      lastSyncedAt: stats.lastSyncedAt?.toISOString() ?? null,
    };
  }

  async start() {
    if (this.state.running)
      throw new ConflictException('As prop firms já estão a ser atualizadas');
    const config = await this.appSettingService.apiConfig('propfirm');

    this.state = {
      running: true,
      startedAt: new Date().toISOString(),
      finishedAt: null,
      error: null,
      progress: null,
    };
    void syncPropFirms(
      config,
      this.platformRepository,
      this.countryRepository,
      (progress) => {
        this.state.progress = progress;
      },
    )
      .then((result) =>
        this.logger.log(`Prop firms: ${JSON.stringify(result)}`),
      )
      .catch((error: Error) => {
        this.state.error = error.message;
        this.logger.warn(`Prop firms: ${error.message}`);
      })
      .finally(() => {
        this.state.running = false;
        this.state.finishedAt = new Date().toISOString();
      });

    return this.status();
  }

  async compare() {
    const config = await this.appSettingService.apiConfig('propfirm');
    return comparePropFirms(
      config,
      this.platformRepository,
      this.countryRepository,
    );
  }

  /** Todas as prop firms da base, com o que está guardado de cada uma (sem ir à API). */
  async fromDatabase() {
    const firms = await this.platformRepository.findByTypeWithPlanCount(PROP_FIRM_TYPE);
    return firms.map(({ _count, ...firm }) => ({ ...firm, planCount: _count.plans }));
  }

  async details(platformId: string) {
    return this.platformRepository.findWithPlans(platformId);
  }
}

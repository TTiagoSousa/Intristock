import {
  Injectable,
  Logger,
  OnApplicationBootstrap,
  OnModuleDestroy,
} from '@nestjs/common';
import { AppSettingService } from 'src/app-setting/app-setting.service';
import { startScheduledJob } from 'src/common/scheduledJob';
import { NotificationService } from 'src/notification/notification.service';
import { checkInstalledVersion } from './helpers/checkInstalledVersion';
import { checkNewRelease } from './helpers/checkNewRelease';
import { PrismaSystemRepository } from './repositories/prisma/prisma-system-repository';

// Procura versões novas no repositório de 6 em 6 horas
const CHECK_EVERY_MS = 6 * 60 * 60 * 1000;
// A primeira procura depois do arranque (as outras tarefas têm outros tempos)
const CHECK_STAGGER_MS = 90_000;

/**
 * Os avisos das versões: no arranque, a versão nova que entrou (para todos; só lê o git
 * local); de 6 em 6 horas, uma versão nova para instalar (para os admins; nas tags
 * locais, que o intristock-fetch.timer traz como root). No arranque esta só corre se já passaram as 6 horas desde a
 * última vez (no AppSetting).
 */
@Injectable()
export class VersionWatchService
  implements OnApplicationBootstrap, OnModuleDestroy
{
  private readonly logger = new Logger(VersionWatchService.name);
  private stopCheck?: () => void;

  constructor(
    private readonly repository: PrismaSystemRepository,
    private readonly notifications: NotificationService,
    private readonly settings: AppSettingService,
  ) {}

  onApplicationBootstrap() {
    void this.checkInstalled();
    this.stopCheck = startScheduledJob({
      name: 'system.version-watch',
      everyMs: CHECK_EVERY_MS,
      staggerMs: CHECK_STAGGER_MS,
      store: this.settings,
      run: () => this.checkNew(),
      logger: this.logger,
    });
  }

  onModuleDestroy() {
    this.stopCheck?.();
  }

  private async checkInstalled() {
    try {
      const version = await checkInstalledVersion(
        this.repository,
        this.notifications,
      );
      if (version)
        this.logger.log(`Versão instalada: ${version} (utilizadores avisados)`);
    } catch (error) {
      this.logger.warn(`Não deu para ver a versão instalada: ${String(error)}`);
    }
  }

  private async checkNew() {
    try {
      const version = await checkNewRelease(
        this.repository,
        this.notifications,
      );
      if (version)
        this.logger.log(
          `Versão nova para instalar: ${version} (admins avisados)`,
        );
    } catch (error) {
      this.logger.warn(`Não deu para procurar versões novas: ${String(error)}`);
    }
  }
}

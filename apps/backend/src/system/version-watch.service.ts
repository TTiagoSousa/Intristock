import {
  Injectable,
  Logger,
  OnApplicationBootstrap,
  OnModuleDestroy,
} from '@nestjs/common';
import { NotificationService } from 'src/notification/notification.service';
import { checkInstalledVersion } from './helpers/checkInstalledVersion';
import { checkNewRelease } from './helpers/checkNewRelease';
import { PrismaSystemRepository } from './repositories/prisma/prisma-system-repository';

// Procura versões novas no repositório de 6 em 6 horas
const CHECK_EVERY_MS = 6 * 60 * 60 * 1000;

/**
 * Os avisos das versões: no arranque, a versão nova que entrou (para todos); no
 * arranque e de 6 em 6 horas, uma versão nova para instalar (para os admins).
 */
@Injectable()
export class VersionWatchService
  implements OnApplicationBootstrap, OnModuleDestroy
{
  private readonly logger = new Logger(VersionWatchService.name);
  private timer: NodeJS.Timeout | null = null;

  constructor(
    private readonly repository: PrismaSystemRepository,
    private readonly notifications: NotificationService,
  ) {}

  onApplicationBootstrap() {
    void this.checkInstalled().then(() => this.checkNew());
    this.timer = setInterval(() => void this.checkNew(), CHECK_EVERY_MS);
  }

  onModuleDestroy() {
    if (this.timer) clearInterval(this.timer);
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

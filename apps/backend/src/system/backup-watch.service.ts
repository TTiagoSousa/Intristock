import { Injectable, Logger, OnApplicationBootstrap, OnModuleDestroy } from '@nestjs/common';
import { AppSettingService } from 'src/app-setting/app-setting.service';
import { startScheduledJob } from 'src/common/scheduledJob';
import { NotificationService } from 'src/notification/notification.service';
import { checkBackupStatus } from './helpers/checkBackupStatus';
import { PrismaSystemRepository } from './repositories/prisma/prisma-system-repository';

// Vê o estado do último backup de hora a hora (o backup corre de noite, às 03:30)
const CHECK_EVERY_MS = 60 * 60 * 1000;
// A primeira volta depois do arranque (as outras tarefas têm outros tempos)
const CHECK_STAGGER_MS = 150_000;

/**
 * O aviso aos admins quando o backup da VM falha (o `backup.json` do
 * deploy/proxmox/backup.sh, ver `checkBackupStatus`).
 */
@Injectable()
export class BackupWatchService implements OnApplicationBootstrap, OnModuleDestroy {
  private readonly logger = new Logger(BackupWatchService.name);
  private stopCheck?: () => void;

  constructor(
    private readonly repository: PrismaSystemRepository,
    private readonly notifications: NotificationService,
    private readonly settings: AppSettingService,
  ) {}

  onApplicationBootstrap() {
    this.stopCheck = startScheduledJob({
      name: 'system.backup-watch',
      everyMs: CHECK_EVERY_MS,
      staggerMs: CHECK_STAGGER_MS,
      store: this.settings,
      run: () => this.check(),
      logger: this.logger,
    });
  }

  onModuleDestroy() {
    this.stopCheck?.();
  }

  private async check() {
    try {
      const at = await checkBackupStatus(this.repository, this.notifications);
      if (at) this.logger.warn(`O backup de ${at} falhou (admins avisados)`);
    } catch (error) {
      this.logger.warn(`Não deu para ver o estado do backup: ${String(error)}`);
    }
  }
}

import { Injectable, Logger, OnModuleDestroy, OnModuleInit } from '@nestjs/common';
import { AppSettingService } from 'src/app-setting/app-setting.service';
import { startScheduledJob } from 'src/common/scheduledJob';
import { PrismaRetentionRepository } from './repositories/prisma/prisma-retention-repository';
import { deleteOldNotifications } from './helpers/deleteOldNotifications';
import { deleteOldLiveTestEvents } from './helpers/deleteOldLiveTestEvents';

// Uma vez por dia
const EVERY_MS = 24 * 60 * 60 * 1000;
// A primeira volta depois do arranque (as outras tarefas têm outros tempos)
const STAGGER_MS = 240_000;

/**
 * A limpeza diária das tabelas que só crescem: os avisos lidos antigos e os registos das
 * condições dos testes ao vivo já acabados. A hora da última volta fica no AppSetting.
 */
@Injectable()
export class RetentionService implements OnModuleInit, OnModuleDestroy {
  private readonly logger = new Logger(RetentionService.name);
  private stop?: () => void;

  constructor(
    private readonly repository: PrismaRetentionRepository,
    private readonly settings: AppSettingService,
  ) {}

  onModuleInit() {
    this.stop = startScheduledJob({
      name: 'retention.cleanup',
      everyMs: EVERY_MS,
      staggerMs: STAGGER_MS,
      store: this.settings,
      run: () => this.cleanup(),
      logger: this.logger,
    });
  }

  onModuleDestroy() {
    this.stop?.();
  }

  // Cada tabela à parte: uma que falhe não impede a outra
  async cleanup() {
    const notifications = await deleteOldNotifications(this.repository).catch((error: Error) => {
      this.logger.warn(`Avisos por limpar: ${error.message}`);
      return 0;
    });
    const liveEvents = await deleteOldLiveTestEvents(this.repository).catch((error: Error) => {
      this.logger.warn(`Registos dos testes ao vivo por limpar: ${error.message}`);
      return 0;
    });
    if (notifications || liveEvents)
      this.logger.log(`Limpeza: ${notifications} avisos, ${liveEvents} registos dos testes ao vivo`);
  }
}

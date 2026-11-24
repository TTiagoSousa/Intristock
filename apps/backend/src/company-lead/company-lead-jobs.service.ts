import { Injectable, Logger, OnApplicationBootstrap, OnModuleDestroy } from '@nestjs/common';
import { AppSettingService } from 'src/app-setting/app-setting.service';
import { startScheduledJob } from 'src/common/scheduledJob';
import { NotificationService } from 'src/notification/notification.service';
import { CompanyLeadService } from './company-lead.service';
import { PrismaCompanyLeadRepository } from './repositories/prisma/prisma-company-lead-repository';

// As automações e os avisos de voltar a ligar correm de 5 em 5 minutos, mesmo sem ninguém com o quadro aberto
const EVERY_MS = 5 * 60 * 1000;
const STAGGER_MS = 3 * 60 * 1000;

/**
 * As Leads em fundo: em cada secção com automações ligadas, lê a origem, cria as leads das linhas novas e corre as
 * automações (o mesmo que abrir o quadro); depois avisa quem tem uma lead atribuída quando chega a hora de voltar a
 * ligar (uma vez por hora marcada). Uma secção que falhe não para as outras.
 */
@Injectable()
export class CompanyLeadJobsService implements OnApplicationBootstrap, OnModuleDestroy {
  private readonly logger = new Logger(CompanyLeadJobsService.name);
  private stop?: () => void;

  constructor(
    private readonly repository: PrismaCompanyLeadRepository,
    private readonly leads: CompanyLeadService,
    private readonly notifications: NotificationService,
    private readonly settings: AppSettingService,
  ) {}

  onApplicationBootstrap() {
    this.stop = startScheduledJob({
      name: 'company-lead.background',
      everyMs: EVERY_MS,
      staggerMs: STAGGER_MS,
      store: this.settings,
      run: () => this.run(),
      logger: this.logger,
    });
  }

  onModuleDestroy() {
    this.stop?.();
  }

  async run() {
    await this.runRules();
    await this.notifyCallbacks();
  }

  async runRules() {
    for (const board of await this.repository.findBoardsWithRules()) {
      try {
        await this.leads.syncBoard(board, await this.repository.findStages(board.id));
      } catch (error) {
        this.logger.warn(`Automações da secção ${board.id}: ${(error as Error).message}`);
      }
    }
  }

  async notifyCallbacks(now = new Date()) {
    const due = await this.repository.findDueCallbacks(now);
    const keyOf = (lead: (typeof due)[number]) => `${lead.id}:${lead.callbackAt!.toISOString()}`;
    const sent = await this.repository.findSentCallbackKeys(due.map(keyOf));
    const pending = due.filter((lead) => !sent.has(keyOf(lead)));
    const titles = new Map<string, string>();
    for (const boardId of new Set(pending.map((l) => l.board.id))) {
      const leads = pending.filter((l) => l.board.id === boardId);
      for (const [rowKey, title] of await this.leads.leadTitles(leads[0].board, leads.map((l) => l.rowKey))) titles.set(`${boardId}:${rowKey}`, title);
    }
    for (const lead of pending) {
      const callbackKey = keyOf(lead);
      const link = `/w/${lead.board.company.slug}/call-center/leads/${lead.board.id}?lead=${encodeURIComponent(lead.rowKey)}`;
      await this.notifications.send(
        [lead.assignedToId!],
        'lead_callback_due',
        {
          callbackKey,
          leadId: lead.id,
          rowKey: lead.rowKey,
          title: titles.get(`${lead.board.id}:${lead.rowKey}`) ?? lead.rowKey,
          boardName: lead.board.name,
          note: lead.callbackNote,
          at: lead.callbackAt!.toISOString(),
        },
        link,
      );
    }
  }
}

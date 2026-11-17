import {
  Injectable,
  Logger,
  OnModuleDestroy,
  OnModuleInit,
} from '@nestjs/common';
import { StockPriceService } from 'src/market-data/stock-price.service';
import { PrismaPersonalPortfolioRepository } from './repositories/prisma/prisma-personal-portfolio-repository';
import { syncTrading212 } from './helpers/syncTrading212';

// De quanto em quanto tempo se vê se há ligações por sincronizar
const CHECK_EVERY_MS = 5 * 60 * 1000;
// Cada ligação sincroniza-se de hora a hora (com folga para a volta não escorregar)
const SYNC_EVERY_MS = 55 * 60 * 1000;

/**
 * Sincroniza as ligações às corretoras de hora a hora, uma de cada vez (os limites da
 * API são por conta). Uma ligação nunca corre duas vezes ao mesmo tempo; uma que
 * falhe fica com o erro e tenta-se outra vez na hora seguinte.
 */
@Injectable()
export class BrokerSyncService implements OnModuleInit, OnModuleDestroy {
  private readonly logger = new Logger(BrokerSyncService.name);
  private timer: NodeJS.Timeout | null = null;
  private checking = false;
  private readonly running = new Map<string, Promise<{ imported: number }>>();

  constructor(
    private readonly repository: PrismaPersonalPortfolioRepository,
    private readonly stocks: StockPriceService,
  ) {}

  onModuleInit() {
    void this.check();
    this.timer = setInterval(() => void this.check(), CHECK_EVERY_MS);
  }

  onModuleDestroy() {
    if (this.timer) clearInterval(this.timer);
  }

  /** Sincroniza já (ou espera pela que já está a correr). */
  sync(connectionId: string): Promise<{ imported: number }> {
    const current = this.running.get(connectionId);
    if (current) return current;
    const run = this.run(connectionId).finally(() => this.running.delete(connectionId));
    this.running.set(connectionId, run);
    return run;
  }

  isSyncing(connectionId: string) {
    return this.running.has(connectionId);
  }

  private async run(connectionId: string) {
    try {
      const result = await syncTrading212(connectionId, this.repository, this.stocks);
      if (result.imported) this.logger.log(`Corretora ${connectionId}: ${result.imported} movimentos novos`);
      return result;
    } catch (error) {
      const message = (error as Error).message;
      this.logger.warn(`Corretora ${connectionId} por sincronizar: ${message}`);
      await this.repository
        .updateConnection(connectionId, { status: 'error', lastError: message, syncedAt: new Date() })
        .catch(() => undefined);
      return { imported: 0 };
    }
  }

  private async check() {
    if (this.checking) return;
    this.checking = true;
    try {
      const due = await this.repository.findConnectionsToSync(new Date(Date.now() - SYNC_EVERY_MS));
      for (const { id } of due) await this.sync(id);
    } catch (error) {
      this.logger.warn(`Ligações por ver: ${(error as Error).message}`);
    } finally {
      this.checking = false;
    }
  }
}

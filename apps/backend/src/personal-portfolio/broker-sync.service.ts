import {
  Injectable,
  Logger,
  OnModuleDestroy,
  OnModuleInit,
} from '@nestjs/common';
import { StockPriceService } from 'src/market-data/stock-price.service';
import { PrismaPersonalPortfolioRepository } from './repositories/prisma/prisma-personal-portfolio-repository';
import { syncTrading212 } from './helpers/syncTrading212';
import { isConnectionDue } from 'src/common/isConnectionDue';

// De quanto em quanto tempo se vê se há ligações por sincronizar
const CHECK_EVERY_MS = 5 * 60 * 1000;
// A primeira vez depois do arranque
const FIRST_CHECK_MS = 120_000;

/**
 * Sincroniza as ligações às corretoras no intervalo de cada uma (`syncEveryHours`: de hora
 * a hora, uma vez por dia ou de 7 em 7 dias), uma de cada vez (os limites da API são por
 * conta). Uma ligação nunca corre duas vezes ao mesmo tempo; uma que falhe fica com o erro
 * e tenta-se outra vez no intervalo seguinte.
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

  // Quando cada ligação sincronizou fica na base (`syncedAt`): no arranque só correm as em
  // atraso, e só passado um bocado (as outras tarefas têm outros tempos)
  onModuleInit() {
    setTimeout(() => void this.check(), FIRST_CHECK_MS).unref();
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
      // Uma em pausa fica em pausa (com o erro à vista): senão voltava a sincronizar sozinha
      const current = await this.repository.findConnection(connectionId).catch(() => null);
      await this.repository
        .updateConnection(connectionId, {
          status: current?.status === 'paused' ? 'paused' : 'error',
          lastError: message,
          syncedAt: new Date(),
        })
        .catch(() => undefined);
      return { imported: 0 };
    }
  }

  private async check() {
    if (this.checking) return;
    this.checking = true;
    try {
      const now = new Date();
      const due = (await this.repository.findConnectionsToSync()).filter((connection) =>
        isConnectionDue(connection, now),
      );
      for (const { id } of due) await this.sync(id);
    } catch (error) {
      this.logger.warn(`Ligações por ver: ${(error as Error).message}`);
    } finally {
      this.checking = false;
    }
  }
}

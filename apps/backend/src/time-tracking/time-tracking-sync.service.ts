import { Injectable, Logger, OnModuleDestroy, OnModuleInit } from '@nestjs/common';
import { isConnectionDue } from 'src/common/isConnectionDue';
import { PrismaTimeTrackingRepository } from './repositories/prisma/prisma-time-tracking-repository';
import { syncSolidtime } from './helpers/syncSolidtime';
import { applySettlementCredit } from './helpers/applySettlementCredit';

// De quanto em quanto tempo se vê se há ligações por sincronizar
const CHECK_EVERY_MS = 5 * 60 * 1000;
// A primeira volta depois do arranque espera um pouco (com um bocado ao acaso), para um update
// não pôr todos os serviços a sincronizar ao mesmo tempo
const FIRST_CHECK_MIN_MS = 2 * 60 * 1000;
const FIRST_CHECK_JITTER_MS = 3 * 60 * 1000;
// Uma ligação que falhou só se tenta outra vez passado o intervalo dela, no máximo uma hora
const RETRY_MAX_HOURS = 1;

type SyncResult = { entries: number; removed: number };

/**
 * Sincroniza as ligações às apps de horas no intervalo de cada uma (`syncEveryHours`), uma de
 * cada vez. Uma ligação nunca corre duas vezes ao mesmo tempo; uma que falhe fica com o erro (uma
 * pausada continua pausada) e sem mexer no `syncedAt`: a próxima volta boa lê o que faltou (na
 * primeira, tudo, e liga a pessoa da chave). Tenta-se outra vez passado o intervalo, no máximo
 * uma hora (a hora da falha fica em memória).
 */
@Injectable()
export class TimeTrackingSyncService implements OnModuleInit, OnModuleDestroy {
  private readonly logger = new Logger(TimeTrackingSyncService.name);
  private timer: NodeJS.Timeout | null = null;
  private checking = false;
  private readonly running = new Map<string, Promise<SyncResult>>();
  private readonly failedAt = new Map<string, Date>();

  constructor(private readonly repository: PrismaTimeTrackingRepository) {}

  private firstCheck: NodeJS.Timeout | null = null;

  onModuleInit() {
    const delay = FIRST_CHECK_MIN_MS + Math.floor(Math.random() * FIRST_CHECK_JITTER_MS);
    this.firstCheck = setTimeout(() => {
      void this.check();
      this.timer = setInterval(() => void this.check(), CHECK_EVERY_MS);
    }, delay);
  }

  onModuleDestroy() {
    if (this.firstCheck) clearTimeout(this.firstCheck);
    if (this.timer) clearInterval(this.timer);
  }

  /** Sincroniza já (ou espera pela que já está a correr). */
  sync(connectionId: string): Promise<SyncResult> {
    const current = this.running.get(connectionId);
    if (current) return current;
    const run = this.run(connectionId).finally(() => this.running.delete(connectionId));
    this.running.set(connectionId, run);
    return run;
  }

  isSyncing(connectionId: string) {
    return this.running.has(connectionId);
  }

  private async run(connectionId: string): Promise<SyncResult> {
    try {
      const result = await syncSolidtime(connectionId, this.repository);
      // As horas novas gastam primeiro as que os clientes já pagaram adiantadas
      await applySettlementCredit(connectionId, this.repository);
      this.failedAt.delete(connectionId);
      return result;
    } catch (error) {
      const message = (error as Error).message;
      this.logger.warn(`Banco de horas ${connectionId} por sincronizar: ${message}`);
      this.failedAt.set(connectionId, new Date());
      const current = await this.repository.findConnection(connectionId).catch(() => null);
      if (current)
        await this.repository
          .updateConnection(connectionId, {
            status: current.status === 'paused' ? 'paused' : 'error',
            lastError: message,
          })
          .catch(() => undefined);
      return { entries: 0, removed: 0 };
    }
  }

  private async check() {
    if (this.checking) return;
    this.checking = true;
    try {
      const now = new Date();
      const due = (await this.repository.findConnectionsToSync()).filter((connection) => {
        if (!isConnectionDue(connection, now)) return false;
        const failed = this.failedAt.get(connection.id);
        return (
          !failed ||
          isConnectionDue({ syncedAt: failed, syncEveryHours: Math.min(connection.syncEveryHours, RETRY_MAX_HOURS) }, now)
        );
      });
      for (const { id } of due) await this.sync(id);
    } catch (error) {
      this.logger.warn(`Ligações do banco de horas por ver: ${(error as Error).message}`);
    } finally {
      this.checking = false;
    }
  }
}

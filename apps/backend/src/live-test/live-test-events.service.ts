import {
  Injectable,
  Logger,
  OnModuleDestroy,
  OnModuleInit,
} from '@nestjs/common';
import { Client } from 'pg';
import { Observable, Subject, filter } from 'rxjs';

// Espera antes de voltar a ligar ao Postgres depois de a ligação de escuta cair
const RECONNECT_MS = 5000;

// Um aviso do simulador: o preço (tick), registos novos (events), o estado
// (state, o browser vai buscá-lo) ou o estado do teste (status)
export interface Live_Notice {
  id: string;
  type: 'tick' | 'events' | 'state' | 'status';
  [key: string]: unknown;
}

/**
 * Escuta o canal `live_test_event`, onde o simulador avisa do que acontece em
 * cada teste ao vivo, e passa os avisos a quem está a ver esse teste (SSE). Uma
 * só ligação ao Postgres para todos; se cair, volta a ligar.
 */
@Injectable()
export class LiveTestEventsService implements OnModuleInit, OnModuleDestroy {
  private readonly logger = new Logger(LiveTestEventsService.name);
  private readonly notices = new Subject<Live_Notice>();
  private client: Client | null = null;
  private timer: NodeJS.Timeout | null = null;
  private closing = false;

  onModuleInit() {
    void this.connect();
  }

  async onModuleDestroy() {
    this.closing = true;
    if (this.timer) clearTimeout(this.timer);
    await this.client?.end().catch(() => undefined);
  }

  // Os avisos de um teste
  of(id: string): Observable<Live_Notice> {
    return this.notices.pipe(filter((notice) => notice.id === id));
  }

  private async connect() {
    this.timer = null;
    const client = new Client({ connectionString: process.env.DATABASE_URL });
    this.client = client;
    client.on('notification', (message) => {
      if (!message.payload) return;
      try {
        this.notices.next(JSON.parse(message.payload) as Live_Notice);
      } catch {
        // Um aviso que não é JSON não é do simulador
      }
    });
    client.on('error', (error) => this.lost(client, error.message));
    client.on('end', () => this.lost(client, 'fechada'));
    try {
      await client.connect();
      await client.query('LISTEN live_test_event');
    } catch (error) {
      this.lost(client, (error as Error).message);
    }
  }

  // A ligação caiu (ou não abriu): uma só nova tentativa daqui a pouco
  private lost(client: Client, reason: string) {
    if (this.closing || this.client !== client) return;
    this.logger.warn(`Ligação de escuta ao Postgres perdida (${reason})`);
    this.client = null;
    client.end().catch(() => undefined);
    this.timer = setTimeout(() => void this.connect(), RECONNECT_MS);
  }
}

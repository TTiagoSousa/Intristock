import { Injectable, Logger } from '@nestjs/common';
import { AppSettingService } from 'src/app-setting/app-setting.service';
import { PrismaCurrencyRateRepository } from './repositories/prisma/prisma-currency-rate-repository';
import { fetchMissingDayRates, MissingDayRates } from './helpers/fetchMissingDayRates';

// Os dias pedidos à API em cada volta, e a pausa depois de a API falhar
const BATCH_DAYS = 60;
const RETRY_AFTER_MS = 10 * 60 * 1000;

/**
 * A fila das cotações do dia que faltam (`CurrencyRate`). Quem converte não espera pela API:
 * usa o que está guardado e a estimativa, e põe aqui os dias em falta. A fila junta os pedidos
 * (o mesmo dia e moeda só vai uma vez, mesmo com vários dashboards abertos ao mesmo tempo) e
 * enche-os em fundo, aos blocos de `BATCH_DAYS`; na leitura seguinte já lá estão.
 */
@Injectable()
export class CurrencyRateFillService {
  private readonly logger = new Logger(CurrencyRateFillService.name);
  // `${dia}|${alvo}` → o pedido desse dia (as moedas juntam-se)
  private readonly queue = new Map<string, MissingDayRates>();
  // `${dia}|${alvo}|${moeda}` já na fila ou a ser pedido
  private readonly pending = new Set<string>();
  private running = false;
  private pausedUntil = 0;

  constructor(
    private readonly rateRepository: PrismaCurrencyRateRepository,
    private readonly appSettingService: AppSettingService,
  ) {}

  enqueue(missing: MissingDayRates[]) {
    if (Date.now() < this.pausedUntil) return;
    for (const { day, target, currencies } of missing) {
      const key = `${day}|${target.id}`;
      const fresh = currencies.filter((currency) => !this.pending.has(`${key}|${currency.id}`));
      if (!fresh.length) continue;
      const entry = this.queue.get(key) ?? { day, target, currencies: [] };
      for (const currency of fresh) {
        this.pending.add(`${key}|${currency.id}`);
        entry.currencies.push(currency);
      }
      this.queue.set(key, entry);
    }
    void this.drain();
  }

  private async drain() {
    if (this.running) return;
    this.running = true;
    try {
      while (this.queue.size) {
        // Os dias mais recentes primeiro (os que mais se veem)
        const batch = [...this.queue.values()].sort((a, b) => b.day.localeCompare(a.day)).slice(0, BATCH_DAYS);
        for (const entry of batch) this.queue.delete(`${entry.day}|${entry.target.id}`);
        try {
          const { apiDown } = await fetchMissingDayRates(batch, this.rateRepository, () =>
            this.appSettingService.apiConfig('currency'),
          );
          if (apiDown) {
            // Por configurar ou em baixo: esquece a fila e não tenta outra vez durante um bocado
            this.pausedUntil = Date.now() + RETRY_AFTER_MS;
            this.queue.clear();
          }
        } catch (error) {
          this.logger.warn(`Não consegui guardar as cotações em falta: ${String(error)}`);
        } finally {
          for (const entry of batch)
            for (const currency of entry.currencies)
              this.pending.delete(`${entry.day}|${entry.target.id}|${currency.id}`);
        }
      }
    } finally {
      this.running = false;
      // Ao limpar a fila, os que estavam nela deixam de estar pendentes
      if (!this.queue.size) this.pending.clear();
    }
  }
}

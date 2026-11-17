import { Injectable, Logger, OnModuleDestroy, OnModuleInit } from '@nestjs/common';
import { PrismaMarketDataRepository } from './repositories/prisma/prisma-market-data-repository';
import { BrokerStock, ensureStockListing } from './helpers/ensureStockListing';
import { syncStockPrices } from './helpers/syncStockPrices';
import { fetchYahooHourly, YahooHourClose } from './helpers/yahooClient';

// Os fechos põem-se em dia no arranque e de 6 em 6 horas (o do dia acaba quando a bolsa fecha)
const SYNC_EVERY_MS = 6 * 60 * 60 * 1000;
// Os preços de hora a hora (só para os gráficos de 7 dias e 24 horas) ficam em memória uns minutos
const HOURLY_TTL_MS = 10 * 60 * 1000;
// Quantos dias para trás se pedem de uma vez (cobre os 7 dias e o fecho antes deles)
const HOURLY_DAYS = 9;
const DAY_MS = 86_400_000;

/**
 * As ações dos portefólios: o ativo e os mercados de cada uma (o da corretora e o do
 * Yahoo, de onde vem o preço) e os fechos diários do Yahoo, guardados em `InstrumentPrice`.
 * Os de hora a hora não se guardam: pedem-se quando um gráfico curto precisa e ficam em memória.
 */
@Injectable()
export class StockPriceService implements OnModuleInit, OnModuleDestroy {
  private readonly logger = new Logger(StockPriceService.name);
  private timer: NodeJS.Timeout | null = null;
  private running: Promise<unknown> = Promise.resolve();
  private readonly hourly = new Map<string, { at: number; closes: Promise<YahooHourClose[]> }>();
  // Sobe a cada volta que mexeu nos fechos (o resumo dos portefólios usa-o na cache dele)
  private version = 0;

  constructor(private readonly repository: PrismaMarketDataRepository) {}

  onModuleInit() {
    void this.syncPrices();
    this.timer = setInterval(() => void this.syncPrices(), SYNC_EVERY_MS);
  }

  onModuleDestroy() {
    if (this.timer) clearInterval(this.timer);
  }

  /** Muda sempre que os fechos guardados mudam. */
  get pricesVersion() {
    return this.version;
  }

  /** O ativo e o mercado de uma ação de uma corretora (criados da primeira vez). */
  ensureListing(stock: BrokerStock) {
    return ensureStockListing(stock, this.repository);
  }

  /** Põe em dia os fechos (de todos os mercados com posições, ou só dos destes mercados de corretora). */
  syncPrices(brokerInstrumentIds?: string[]) {
    // Uma volta de cada vez: a seguinte espera pela que está a correr
    const run = this.running.then(async () => {
      try {
        const result = await syncStockPrices(this.repository, brokerInstrumentIds);
        if (result.updated) this.version += 1;
        if (result.saved || result.failed.length)
          this.logger.log(
            `Preços das ações: ${result.saved} dias novos em ${result.instruments} mercados` +
              (result.failed.length ? `; falharam ${result.failed.join(', ')}` : ''),
          );
        return result;
      } catch (error) {
        this.logger.warn(`Preços das ações por pôr em dia: ${(error as Error).message}`);
        return null;
      }
    });
    this.running = run;
    return run;
  }

  /**
   * Os fechos de hora a hora dos últimos dias destes mercados do Yahoo, por id. Um que
   * falhe fica de fora (o gráfico usa o fecho do dia dele).
   */
  async hourlyCloses(markets: { id: string; symbol: string }[]) {
    const now = Date.now();
    const result = new Map<string, YahooHourClose[]>();
    await Promise.all(
      markets.map(async (market) => {
        let cached = this.hourly.get(market.symbol);
        if (!cached || now - cached.at > HOURLY_TTL_MS) {
          cached = { at: now, closes: fetchYahooHourly(market.symbol, new Date(now - HOURLY_DAYS * DAY_MS)) };
          this.hourly.set(market.symbol, cached);
        }
        try {
          result.set(market.id, await cached.closes);
        } catch (error) {
          this.hourly.delete(market.symbol);
          this.logger.warn(`Preços de hora a hora de ${market.symbol}: ${(error as Error).message}`);
        }
      }),
    );
    return result;
  }
}

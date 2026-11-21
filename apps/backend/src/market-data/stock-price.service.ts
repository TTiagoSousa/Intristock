import { Injectable, Logger, OnModuleDestroy, OnModuleInit } from '@nestjs/common';
import { PrismaMarketDataRepository } from './repositories/prisma/prisma-market-data-repository';
import { BinanceCandleRepository } from './repositories/binance/binance-candle-repository';
import { CoinbaseCandleRepository } from './repositories/coinbase/coinbase-candle-repository';
import { BrokerStock, ensureStockListing } from './helpers/ensureStockListing';
import { ensureYahooListing } from './helpers/ensureYahooListing';
import { syncStockPrices } from './helpers/syncStockPrices';
import { ExchangeMarket, fetchExchangeDays, fetchExchangeHours } from './helpers/exchangeCloses';
import { fetchYahooChart, fetchYahooHourly, searchYahoo, YahooHourClose } from './helpers/yahooClient';
import { AppSettingService } from 'src/app-setting/app-setting.service';
import { startScheduledJob } from 'src/common/scheduledJob';

// Os fechos põem-se em dia de 6 em 6 horas (o do dia acaba quando a bolsa fecha)
const SYNC_EVERY_MS = 6 * 60 * 60 * 1000;
// A primeira volta depois do arranque (as outras tarefas têm outros tempos)
const SYNC_STAGGER_MS = 45_000;
// Os preços de hora a hora (só para os gráficos de 7 dias e 24 horas) ficam em memória uns minutos
const HOURLY_TTL_MS = 10 * 60 * 1000;
// Quantos mercados no máximo na cache de hora a hora (os mais antigos saem primeiro)
const HOURLY_MAX_MARKETS = 500;
// Quantos dias para trás se pedem de uma vez (cobre os 7 dias e o fecho antes deles)
const HOURLY_DAYS = 9;
// O fecho de um dia: até uns dias antes (fins de semana, feriados)
const PRICE_LOOKBACK_DAYS = 7;
const DAY_MS = 86_400_000;
// Quantos mercados de cripto devolve uma pesquisa
const SEARCH_TAKE = 30;

/** Um mercado de onde vem um preço (do Yahoo, da Binance ou da Coinbase). */
export type PricedMarket = ExchangeMarket & { id: string };

/**
 * Os preços dos portefólios: o ativo e os mercados de cada ação de uma corretora (o da
 * corretora e o do Yahoo, de onde vem o preço), as compras à mão (uma ação do Yahoo ou um
 * par da Binance ou da Coinbase, que dão o preço eles próprios) e os fechos diários deles,
 * guardados em `InstrumentPrice`. Os de hora a hora não se guardam: pedem-se quando um
 * gráfico curto precisa e ficam em memória.
 */
@Injectable()
export class StockPriceService implements OnModuleInit, OnModuleDestroy {
  private readonly logger = new Logger(StockPriceService.name);
  private stopSync?: () => void;
  private running: Promise<unknown> = Promise.resolve();
  private readonly hourly = new Map<string, { at: number; closes: Promise<YahooHourClose[]> }>();
  // Sobe a cada volta que mexeu nos fechos (o resumo dos portefólios usa-o na cache dele)
  private version = 0;

  constructor(
    private readonly repository: PrismaMarketDataRepository,
    private readonly binance: BinanceCandleRepository,
    private readonly coinbase: CoinbaseCandleRepository,
    private readonly settings: AppSettingService,
  ) {}

  // No arranque só se já passaram as 6 horas desde a última volta (no AppSetting)
  onModuleInit() {
    this.stopSync = startScheduledJob({
      name: 'market-data.stock-prices',
      everyMs: SYNC_EVERY_MS,
      staggerMs: SYNC_STAGGER_MS,
      store: this.settings,
      run: () => this.syncPrices(),
      logger: this.logger,
    });
  }

  onModuleDestroy() {
    this.stopSync?.();
  }

  /** Muda sempre que os fechos guardados mudam. */
  get pricesVersion() {
    return this.version;
  }

  /** O ativo e o mercado de uma ação de uma corretora (criados da primeira vez). */
  ensureListing(stock: BrokerStock) {
    return ensureStockListing(stock, this.repository);
  }

  /** O ativo e o mercado do Yahoo de um símbolo escolhido à mão (criados da primeira vez). */
  ensureYahooListing(symbol: string) {
    return ensureYahooListing(symbol, this.repository);
  }

  /** Um mercado pelo id (um par da Binance ou da Coinbase escolhido à mão). */
  findMarket(instrumentId: string) {
    return this.repository.findInstrumentById(instrumentId);
  }

  /** As ações e os ETF que o Yahoo encontra para um texto (ticker, nome, ISIN). */
  searchStocks(query: string) {
    return searchYahoo(query);
  }

  /** Os pares à vista de uma corretora de cripto (binance, coinbase) que batem com o texto. */
  async searchCrypto(source: string, query: string) {
    const rows = await this.repository.searchExchangeInstruments(source, query, SEARCH_TAKE * 4);
    const wanted = query.trim().toUpperCase();
    // Primeiro o ticker igual ao texto, e as cotadas mais comuns
    const quoteRank = (quote: string) => {
      const index = ['EUR', 'USDC', 'USDT', 'USD'].indexOf(quote);
      return index < 0 ? 9 : index;
    };
    return rows
      .sort(
        (a, b) =>
          Number(b.asset.ticker?.toUpperCase() === wanted) - Number(a.asset.ticker?.toUpperCase() === wanted) ||
          quoteRank(a.quote) - quoteRank(b.quote) ||
          a.symbol.localeCompare(b.symbol),
      )
      .slice(0, SEARCH_TAKE);
  }

  /** O fecho de um mercado num dia (o último até esse dia; hoje, o preço de agora). */
  // Com a moeda do preço (no Yahoo, a do símbolo; nos pares, a cotada)
  async priceOn(market: ExchangeMarket & { quote?: string }, day: string) {
    const date = new Date(`${day}T00:00:00.000Z`);
    const from = new Date(date.getTime() - PRICE_LOOKBACK_DAYS * DAY_MS);
    let quote = market.quote ?? null;
    let days: { date: string; close: number }[];
    if (market.source === 'yahoo') {
      const chart = await fetchYahooChart(market.symbol, from, date);
      quote = chart?.currency ?? quote;
      days = chart?.days ?? [];
    } else days = await fetchExchangeDays(market, from, this.binance, this.coinbase);
    const found = days.filter((row) => row.date <= day).at(-1);
    return found ? { date: found.date, close: found.close, quote } : null;
  }

  /** Põe em dia os fechos (de todos os mercados com posições, ou só destes mercados). */
  syncPrices(instrumentIds?: string[]) {
    // Uma volta de cada vez: a seguinte espera pela que está a correr
    const run = this.running.then(async () => {
      try {
        const result = await syncStockPrices(this.repository, instrumentIds, (market, from) =>
          fetchExchangeDays(market, from, this.binance, this.coinbase),
        );
        if (result.updated) this.version += 1;
        if (result.saved || result.failed.length)
          this.logger.log(
            `Preços dos portefólios: ${result.saved} dias novos em ${result.instruments} mercados` +
              (result.failed.length ? `; falharam ${result.failed.join(', ')}` : ''),
          );
        return result;
      } catch (error) {
        this.logger.warn(`Preços dos portefólios por pôr em dia: ${(error as Error).message}`);
        return null;
      }
    });
    this.running = run;
    return run;
  }

  /**
   * Os fechos de hora a hora dos últimos dias destes mercados (do Yahoo, da Binance ou da
   * Coinbase), por id. Um que falhe fica de fora (o gráfico usa o fecho do dia dele).
   */
  async hourlyCloses(markets: PricedMarket[]) {
    const now = Date.now();
    const result = new Map<string, YahooHourClose[]>();
    // Os que já expiraram saem (senão a cache só crescia) e, acima do limite, os mais antigos
    for (const [key, entry] of this.hourly) if (now - entry.at > HOURLY_TTL_MS) this.hourly.delete(key);
    for (const key of this.hourly.keys()) {
      if (this.hourly.size <= HOURLY_MAX_MARKETS) break;
      this.hourly.delete(key);
    }
    await Promise.all(
      markets.map(async (market) => {
        const key = `${market.source}:${market.type}:${market.symbol}`;
        let cached = this.hourly.get(key);
        if (!cached || now - cached.at > HOURLY_TTL_MS) {
          const from = new Date(now - HOURLY_DAYS * DAY_MS);
          cached = {
            at: now,
            closes:
              market.source === 'yahoo'
                ? fetchYahooHourly(market.symbol, from)
                : fetchExchangeHours(market, from, this.binance, this.coinbase),
          };
          this.hourly.set(key, cached);
        }
        try {
          result.set(market.id, await cached.closes);
        } catch (error) {
          this.hourly.delete(key);
          this.logger.warn(`Preços de hora a hora de ${market.symbol}: ${(error as Error).message}`);
        }
      }),
    );
    return result;
  }
}

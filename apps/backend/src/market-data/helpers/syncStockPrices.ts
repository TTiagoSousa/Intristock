import { PrismaMarketDataRepository } from '../repositories/prisma/prisma-market-data-repository';
import { fetchYahooChart } from './yahooClient';

// Antes da primeira transação, uns dias a mais (o fecho anterior a um fim de semana)
const LEAD_DAYS = 10;
// O último dia guardado volta a pedir-se (o de hoje muda até a bolsa fechar)
const REFETCH_DAYS = 3;
// Entre mercados, para não pedir ao Yahoo tudo de seguida
const GAP_MS = 400;
const DAY_MS = 86_400_000;

const isoDay = (date: Date) => date.toISOString().slice(0, 10);
const sleep = (ms: number) => new Promise((resolve) => setTimeout(resolve, ms));

/**
 * Os fechos diários do Yahoo dos mercados que valem posições (os que um mercado de
 * corretora com transações usa para o preço): da primeira transação, ou do último dia
 * guardado, até hoje. Os dias novos entram de uma vez e os últimos atualizam-se. Um
 * mercado que falhe (já depois das novas tentativas do cliente) não pára os outros, e
 * cada um guarda no metadata a última volta boa e o último erro. Devolve quantos dias
 * novos entraram, quantos mercados ficaram em dia e os que falharam.
 */
export async function syncStockPrices(repository: PrismaMarketDataRepository, instrumentIds?: string[]) {
  const targets = await repository.findInstrumentsToPrice(instrumentIds);
  let saved = 0;
  let updated = 0;
  const failed: string[] = [];
  for (const [index, target] of targets.entries()) {
    if (index) await sleep(GAP_MS);
    const from = target.lastDate
      ? new Date(target.lastDate.getTime() - REFETCH_DAYS * DAY_MS)
      : new Date(target.firstDate.getTime() - LEAD_DAYS * DAY_MS);
    const now = new Date().toISOString();
    try {
      const chart = await fetchYahooChart(target.symbol, from);
      if (chart?.days.length) saved += await repository.saveInstrumentPrices(target.id, chart.days, target.lastDate ? isoDay(from) : null);
      updated += 1;
      await repository.savePriceSyncState(target.id, target.metadata, { priceSyncedAt: now, priceError: null, priceErrorAt: null });
    } catch (error) {
      failed.push(target.symbol);
      await repository
        .savePriceSyncState(target.id, target.metadata, { priceError: (error as Error).message, priceErrorAt: now })
        .catch(() => undefined);
    }
  }
  return { instruments: targets.length, saved, updated, failed };
}

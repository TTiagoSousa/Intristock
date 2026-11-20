import { Injectable, Logger, OnModuleDestroy, OnModuleInit } from '@nestjs/common';
import { ApiKeyService } from 'src/api-key/api-key.service';
import { CurrencyService } from 'src/currency/currency.service';
import { PrismaPersonalPortfolioRepository } from './repositories/prisma/prisma-personal-portfolio-repository';
import { refreshGoodsValuation } from './helpers/refreshGoodsValuation';

// De quanto em quanto tempo se vê se há bens por atualizar
const CHECK_EVERY_MS = 60 * 60 * 1000;
// Quantos de cada vez (cada um gasta 2 pesquisas da SerpApi)
const BATCH = 20;
// Um que falhe tenta-se outra vez no dia seguinte
const RETRY_MS = 24 * 60 * 60 * 1000;

/**
 * Atualiza sozinho o valor dos bens com atualização automática (`valuationEveryDays`), de
 * hora a hora, um de cada vez: a pesquisa de preços e a avaliação nova. Abrir um bem nunca
 * pesquisa. Sem chaves com pesquisas, espera pelo dia seguinte.
 */
@Injectable()
export class GoodsValuationService implements OnModuleInit, OnModuleDestroy {
  private readonly logger = new Logger(GoodsValuationService.name);
  private timer: NodeJS.Timeout | null = null;
  private checking = false;

  constructor(
    private readonly repository: PrismaPersonalPortfolioRepository,
    private readonly apiKeys: ApiKeyService,
    private readonly currencyService: CurrencyService,
  ) {}

  onModuleInit() {
    this.timer = setInterval(() => void this.check(), CHECK_EVERY_MS);
    // Não no arranque: deixa o resto da app arrancar primeiro
    setTimeout(() => void this.check(), 60_000).unref();
  }

  onModuleDestroy() {
    if (this.timer) clearInterval(this.timer);
  }

  private async check() {
    if (this.checking) return;
    this.checking = true;
    try {
      const due = await this.repository.findDueGoods(new Date(), BATCH);
      if (!due.length) return;
      if (!(await this.apiKeys.available('motorcycle_prices'))) {
        for (const goods of due)
          await this.repository.updateGoodsAsset(goods.id, { valuationNextAt: new Date(Date.now() + RETRY_MS) });
        this.logger.warn(`${due.length} bens por atualizar: não há chaves da SerpApi com pesquisas`);
        return;
      }
      for (const goods of due) {
        try {
          const result = await refreshGoodsValuation(
            goods.ownerUserId!,
            goods.id,
            this.repository,
            this.apiKeys,
            this.currencyService,
          );
          if (result) this.logger.log(`Bem ${goods.id}: avaliado em ${result.value}`);
        } catch (error) {
          this.logger.warn(`Bem ${goods.id} por atualizar: ${(error as Error).message}`);
          await this.repository
            .updateGoodsAsset(goods.id, { valuationNextAt: new Date(Date.now() + RETRY_MS) })
            .catch(() => undefined);
        }
      }
    } catch (error) {
      this.logger.warn(`Bens por ver: ${(error as Error).message}`);
    } finally {
      this.checking = false;
    }
  }
}

import { Injectable } from '@nestjs/common';
import { ApiKeyService } from 'src/api-key/api-key.service';
import { CurrencyService } from 'src/currency/currency.service';
import { PrismaPersonalPortfolioRepository } from './repositories/prisma/prisma-personal-portfolio-repository';
import { AddGoodsValuationDto, CreateGoodsDto, GoodsPricesDto, SellGoodsDto, UpdateGoodsDto } from './dto/goods.dto';
import { createGoods } from './helpers/createGoods';
import { findGoods } from './helpers/findGoods';
import { addGoodsValuation } from './helpers/addGoodsValuation';
import { sellGoods } from './helpers/sellGoods';
import { updateGoods } from './helpers/updateGoods';
import { searchGoodsPrices } from './helpers/searchGoodsPrices';
import { searchLocations } from './helpers/serpApiMarketplace';

/**
 * Os bens da pessoa nos portefólios (por agora as motas): registar, ver, avaliar (à mão ou
 * pela pesquisa de preços no Facebook Marketplace, com as chaves da SerpApi) e vender.
 */
@Injectable()
export class GoodsService {
  constructor(
    private readonly repository: PrismaPersonalPortfolioRepository,
    private readonly apiKeys: ApiKeyService,
    private readonly currencyService: CurrencyService,
  ) {}

  create(userId: string, dto: CreateGoodsDto) {
    return createGoods(userId, dto, this.repository, this.currencyService);
  }

  find(userId: string, assetId: string) {
    return findGoods(userId, assetId, this.repository);
  }

  async update(userId: string, assetId: string, dto: UpdateGoodsDto) {
    await updateGoods(userId, assetId, dto, this.repository);
    return this.find(userId, assetId);
  }

  async addValuation(userId: string, assetId: string, dto: AddGoodsValuationDto) {
    await addGoodsValuation(userId, assetId, dto, this.repository, this.currencyService);
    return this.find(userId, assetId);
  }

  async sell(userId: string, assetId: string, dto: SellGoodsDto) {
    await sellGoods(userId, assetId, dto, this.repository);
    return this.find(userId, assetId);
  }

  // Gasta 2 pesquisas; não grava nada (a pessoa escolhe e grava a avaliação depois)
  prices(dto: GoodsPricesDto) {
    return searchGoodsPrices(dto, this.apiKeys);
  }

  // Se há chaves com pesquisas, para o ecrã mostrar (ou não) o pesquisar
  async pricesAvailable() {
    return { available: await this.apiKeys.available('motorcycle_prices') };
  }

  locations(query: string) {
    return searchLocations(query);
  }
}

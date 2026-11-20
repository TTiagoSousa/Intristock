import { BadRequestException, NotFoundException } from '@nestjs/common';
import { PrismaPersonalPortfolioRepository } from '../repositories/prisma/prisma-personal-portfolio-repository';
import { PortfolioTransactionData } from '../repositories/personal-portfolio-repository';
import { CreateGoodsDto } from '../dto/goods.dto';
import { IN_KIND } from './portfolioLedger';
import { CurrencyService } from 'src/currency/currency.service';
import { resolveGoodsValuation } from './resolveGoodsValuation';
import { convertGoodsValuation } from './convertGoodsValuation';
import { defaultSearchQuery, goodsName } from './goodsNaming';

const DAY_MS = 86_400_000;
const round = (value: number) => Math.round(value * 100) / 100;

/**
 * Regista uma mota num portefólio manual: o ativo da pessoa (os dados e a atualização
 * automática), a entrada (`buy`, quantidade 1) e, se houver, a avaliação de agora com o
 * relatório da pesquisa. A entrada vale o preço de compra; sem ele (uma oferta), o valor
 * de agora. O dinheiro: novo (o depósito e a saída no próprio portefólio), de outro
 * portefólio (a saída lá) ou nenhum — uma oferta, ou uma compra que não se quer ligar a um
 * portefólio —, e aí o valor entra de fora (\`in_kind\`), para a rentabilidade não o contar
 * como ganho.
 */
export async function createGoods(
  userId: string,
  dto: CreateGoodsDto,
  repository: PrismaPersonalPortfolioRepository,
  currencyService: CurrencyService,
) {
  const portfolioId = dto.portfolioId;
  const portfolio = await repository.findPortfolio(userId, portfolioId);
  if (!portfolio) throw new NotFoundException('Portefólio não encontrado');
  if (portfolio.source === 'api') throw new BadRequestException('Este portefólio vem de uma corretora e é só de leitura');
  const currency = await repository.findCurrency(dto.currencyId);
  if (!currency) throw new NotFoundException('Moeda não encontrada');

  const price = dto.acquisition === 'purchase' ? (dto.price ?? null) : null;
  const date = new Date(dto.date);
  const today = new Date(new Date().toISOString().slice(0, 10));
  // A avaliação de hoje não pode vir antes da entrada
  if (date.toISOString().slice(0, 10) > today.toISOString().slice(0, 10)) throw new BadRequestException('A entrada não pode ter uma data à frente de hoje');
  const resolved = resolveGoodsValuation(dto.valuation);
  // A avaliação de agora: a de uma pesquisa é de hoje; a escrita à mão, do dia da entrada.
  // Os anúncios noutra moeda convertem-se pela cotação desse dia
  const valuationDate = resolved?.report ? today : date;
  const valuation = resolved
    ? await convertGoodsValuation(resolved, currency, valuationDate.toISOString().slice(0, 10), repository, currencyService)
    : null;
  // Com dinheiro, só uma compra com preço
  const cash = price && price > 0 ? dto.cash : 'none';
  const cashPortfolioId = cash === 'portfolio' ? (dto.cashPortfolioId ?? portfolioId) : portfolioId;
  if (cashPortfolioId !== portfolioId) {
    const cashPortfolio = await repository.findPortfolio(userId, cashPortfolioId);
    if (!cashPortfolio) throw new NotFoundException('Portefólio do dinheiro não encontrado');
    if (cashPortfolio.source === 'api') throw new BadRequestException('O dinheiro não pode sair de um portefólio de uma corretora');
  }

  const details = { ...dto.details, searchQuery: dto.details.searchQuery?.trim() || defaultSearchQuery(dto.details) };
  const every = dto.valuationEveryDays ?? null;
  const asset = await repository.createGoodsAsset({
    ownerUserId: userId,
    assetClass: 'alternative',
    subClass: 'vehicle',
    name: goodsName(dto.details, dto.name),
    details,
    valuationEveryDays: every,
    valuationNextAt: every ? new Date(Date.now() + every * DAY_MS) : null,
  });

  const notes = dto.notes?.trim() || null;
  const amount = round(price ?? valuation?.value ?? 0);
  const base = { assetId: asset.id, date, currencyId: currency.id, bankAccountId: null, notes };
  const rows: PortfolioTransactionData[] = [];
  const cashAsset = cash === 'new' ? await repository.ensureCashAsset(currency) : null;
  if (cashAsset) rows.push({ ...base, portfolioId, assetId: cashAsset.id, kind: 'deposit', quantity: amount, price: null, amount });
  rows.push({
    ...base,
    portfolioId,
    kind: 'buy',
    quantity: 1,
    price,
    amount,
    acquisition: dto.acquisition,
    externalType: cash === 'none' ? IN_KIND : null,
  });
  if (cash !== 'none')
    rows.push({ ...base, portfolioId: cashPortfolioId, kind: 'transfer_out', quantity: amount, price: null, amount });
  // O valor de agora, com o relatório (hoje, se veio de uma pesquisa)
  if (valuation)
    rows.push({
      ...base,
      portfolioId,
      date: valuationDate,
      kind: 'valuation',
      quantity: 0,
      price: round(valuation.value),
      amount: round(valuation.value),
      valuationReport: valuation.report,
    });
  await repository.createTransactions(rows);
  return { assetId: asset.id };
}

import { BadRequestException, NotFoundException } from '@nestjs/common';
import { StockPriceService } from 'src/market-data/stock-price.service';
import { PrismaPersonalPortfolioRepository } from '../repositories/prisma/prisma-personal-portfolio-repository';
import { PortfolioTransactionData } from '../repositories/personal-portfolio-repository';
import { CreatePositionTransactionDto } from '../dto/personal-portfolio.dto';
import { POSITION_SIGN } from './portfolioLedger';

// Os mercados de cripto que se escolhem à mão
const CRYPTO_SOURCES = ['binance', 'coinbase'];
const round = (value: number, digits = 2) => Math.round(value * 10 ** digits) / 10 ** digits;

/**
 * Uma compra ou venda à mão num portefólio da pessoa, como as da corretora: a linha da
 * posição (a quantidade e o preço com a comissão, `buy`/`sell`) e a do dinheiro
 * (`transfer_out`/`transfer_in`) no portefólio de onde ele sai ou para onde vai — o
 * próprio ou outro. Com dinheiro novo, junta-se o depósito (compra) ou o levantamento
 * (venda) no próprio, para a rentabilidade não contar o dinheiro como ganho. O mercado é
 * uma ação do Yahoo (criada da primeira vez) ou um par da Binance ou da Coinbase; os
 * fechos dele põem-se logo em dia. Não se vende mais do que se tem no portefólio.
 */
export async function createPositionTransaction(
  userId: string,
  portfolioId: string,
  dto: CreatePositionTransactionDto,
  repository: PrismaPersonalPortfolioRepository,
  stocks: StockPriceService,
) {
  const portfolio = await repository.findPortfolio(userId, portfolioId);
  if (!portfolio) throw new NotFoundException('Portefólio não encontrado');
  if (portfolio.source === 'api')
    throw new BadRequestException('Este portefólio vem de uma corretora e é só de leitura');

  const cashPortfolioId = dto.cash === 'portfolio' ? (dto.cashPortfolioId ?? portfolioId) : portfolioId;
  if (cashPortfolioId !== portfolioId) {
    const cashPortfolio = await repository.findPortfolio(userId, cashPortfolioId);
    if (!cashPortfolio) throw new NotFoundException('Portefólio do dinheiro não encontrado');
    if (cashPortfolio.source === 'api')
      throw new BadRequestException('O dinheiro não pode sair de um portefólio de uma corretora');
  }

  const currency = await repository.findCurrency(dto.currencyId);
  if (!currency) throw new NotFoundException('Moeda não encontrada');

  // O mercado: uma ação do Yahoo ou um par de uma corretora de cripto
  let listing: { assetId: string; instrumentId: string };
  if (dto.yahooSymbol) listing = await stocks.ensureYahooListing(dto.yahooSymbol.trim().toUpperCase());
  else {
    const market = await stocks.findMarket(dto.instrumentId!);
    if (!market || !CRYPTO_SOURCES.includes(market.source) || market.type !== 'spot')
      throw new BadRequestException('Escolhe um par à vista da Binance ou da Coinbase');
    listing = { assetId: market.assetId, instrumentId: market.id };
  }

  if (dto.kind === 'sell') {
    const held = (await repository.findPositionTransactions(portfolioId, listing.instrumentId)).reduce(
      (sum, tx) => sum + POSITION_SIGN[tx.kind] * Number(tx.quantity),
      0,
    );
    if (dto.quantity > held + 1e-9)
      throw new BadRequestException(`Só tens ${round(held, 8)} neste portefólio para vender`);
  }

  // O valor: a quantidade × o preço, com a comissão (paga-se na compra, desconta na venda)
  const fee = dto.fee ?? 0;
  const gross = dto.quantity * dto.price;
  const amount = round(dto.kind === 'buy' ? gross + fee : gross - fee);
  if (amount <= 0) throw new BadRequestException('A comissão não pode ser maior do que o valor');

  const date = new Date(dto.date);
  const notes = dto.notes?.trim() || null;
  const base = { assetId: listing.assetId, date, currencyId: currency.id, bankAccountId: null };
  const rows: PortfolioTransactionData[] = [];
  const cashAsset = dto.cash === 'new' ? await repository.ensureCashAsset(currency) : null;
  // Dinheiro novo numa compra: primeiro entra
  if (cashAsset && dto.kind === 'buy')
    rows.push({ ...base, portfolioId, assetId: cashAsset.id, kind: 'deposit', quantity: amount, price: null, amount, notes });
  rows.push({
    ...base,
    portfolioId,
    instrumentId: listing.instrumentId,
    kind: dto.kind,
    quantity: dto.quantity,
    // Como nas da corretora: o preço com a comissão
    price: round(amount / dto.quantity, 8),
    amount,
    notes,
  });
  rows.push({
    ...base,
    portfolioId: cashPortfolioId,
    instrumentId: listing.instrumentId,
    kind: dto.kind === 'buy' ? 'transfer_out' : 'transfer_in',
    quantity: amount,
    price: null,
    amount,
    notes,
  });
  // Dinheiro novo numa venda: o que se recebeu sai da carteira
  if (cashAsset && dto.kind === 'sell')
    rows.push({ ...base, portfolioId, assetId: cashAsset.id, kind: 'withdrawal', quantity: amount, price: null, amount, notes });

  const created = await repository.createTransactions(rows);
  // Os fechos deste mercado, até hoje (em fundo: a resposta não espera)
  void stocks.syncPrices([listing.instrumentId]);
  return created;
}

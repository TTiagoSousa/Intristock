import { BadRequestException, NotFoundException } from '@nestjs/common';
import { PrismaPersonalPortfolioRepository } from '../repositories/prisma/prisma-personal-portfolio-repository';
import { CreateCashTransactionDto } from '../dto/personal-portfolio.dto';

/**
 * Grava uma transação de dinheiro passivo num portefólio da pessoa. O ativo é o
 * dinheiro da moeda (criado da primeira vez); a quantidade é o próprio valor e
 * não há preço. A conta poupança, se vier, é uma das contas pessoais, na mesma moeda.
 */
export async function createCashTransaction(
  userId: string,
  portfolioId: string,
  dto: CreateCashTransactionDto,
  repository: PrismaPersonalPortfolioRepository,
) {
  const portfolio = await repository.findPortfolio(userId, portfolioId);
  if (!portfolio) throw new NotFoundException('Portefólio não encontrado');
  // Os de uma corretora mantém-nos a ligação
  if (portfolio.source === 'api')
    throw new BadRequestException('Este portefólio vem de uma corretora e é só de leitura');

  const currency = await repository.findCurrency(dto.currencyId);
  if (!currency) throw new NotFoundException('Moeda não encontrada');

  if (dto.bankAccountId) {
    const account = await repository.findUserBankAccount(
      userId,
      dto.bankAccountId,
    );
    if (!account) throw new NotFoundException('Conta bancária não encontrada');
    if (account.currencyId !== currency.id)
      throw new BadRequestException(
        'A conta tem de estar na moeda da transação',
      );
  }

  const asset = await repository.ensureCashAsset(currency);
  return repository.createTransaction({
    portfolioId,
    assetId: asset.id,
    kind: dto.kind,
    date: new Date(dto.date),
    quantity: dto.amount,
    price: null,
    amount: dto.amount,
    currencyId: currency.id,
    bankAccountId: dto.bankAccountId ?? null,
    notes: dto.notes?.trim() || null,
  });
}

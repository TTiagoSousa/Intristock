import {
  BadRequestException,
  ForbiddenException,
  Logger,
  NotFoundException,
} from '@nestjs/common';
import { PrismaCompanyPaymentRepository } from '../repositories/prisma/prisma-company-payment-repository';
import { assertCompanyAccess } from 'src/company/helpers/assertCompanyAccess';
import { PrismaCompanyRepository } from 'src/company/repositories/prisma/prisma-company-repository';
import { PrismaCompanyStockRepository } from 'src/company-stock/repositories/prisma/prisma-company-stock-repository';
import { PrismaCompanyAssetRepository } from 'src/company-asset/repositories/prisma/prisma-company-asset-repository';
import { calculateStockBalance } from 'src/company-stock/helpers/calculateStockBalance';
import { StorageService } from 'src/storage/storage.service';

const logger = new Logger('deleteCompanyPayment');

export async function deleteCompanyPayment(
  userId: string,
  companyId: string,
  paymentId: string,
  companyPaymentRepository: PrismaCompanyPaymentRepository,
  companyRepository: PrismaCompanyRepository,
  stockRepository: PrismaCompanyStockRepository,
  assetRepository: PrismaCompanyAssetRepository,
  storage: StorageService,
) {
  // Mesma regra do resto da app: só quem criou a empresa é que mexe nela
  await assertCompanyAccess(userId, companyId, companyRepository, {
    notYours: 'Não podes apagar pagamentos de uma empresa que não é tua',
    permission: 'payments.delete',
  });

  const payment = await companyPaymentRepository.findById(paymentId);

  // Sem o segundo teste, quem soubesse o id conseguia apagar o pagamento de
  // outra empresa através de uma empresa sua
  if (!payment || payment.companyId !== companyId) {
    throw new NotFoundException('Pagamento não encontrado');
  }

  // Um ativo não é um número que se recomponha: é uma ficha em que se trabalha
  // ao longo dos anos — taxa, vida útil, notas de manutenção, abate. A fatura é
  // só o papel de onde a máquina veio, e apagá-la não pode levar a máquina
  // atrás. Quem quiser mesmo removê-la, apaga primeiro o ativo.
  const assets = await assetRepository.findAllByPaymentId(paymentId);

  if (assets.length > 0) {
    const names = assets.map((asset) => `"${asset.name}"`).join(', ');

    throw new BadRequestException(
      assets.length === 1
        ? `Esta compra criou o ativo ${names} — apaga o ativo primeiro se for mesmo para o remover`
        : `Esta compra criou ${assets.length} ativos (${names}) — apaga-os primeiro se for mesmo para os remover`,
    );
  }

  // Apagar uma compra devolve o stock que ela trouxe. Se esse stock já foi
  // gasto, o saldo ficava negativo — e o negativo não passa por lado nenhum.
  const movements = await stockRepository.findAllByPaymentId(paymentId);
  const affectedItems = new Set(movements.map((movement) => movement.itemId));

  for (const itemId of affectedItems) {
    const all = await stockRepository.findAllByItemId(companyId, itemId);
    const [without] = calculateStockBalance(
      all.filter((row) => row.paymentId !== paymentId),
    );

    if (without && without.quantity < 0) {
      const unit = without.stockUnit ? ` ${without.stockUnit}` : '';

      throw new BadRequestException(
        `Sem esta compra, "${without.itemName}" ficava a ${without.quantity}${unit} — o stock que ela trouxe já foi gasto`,
      );
    }
  }

  // As chaves são lidas antes de as linhas desaparecerem, senão perdia-se a
  // referência para os ficheiros e ficavam para sempre no bucket
  const documents = await companyPaymentRepository.findDocuments(paymentId);

  await companyPaymentRepository.delete(paymentId);

  // Os ficheiros saem depois e por tentativa: se o storage estiver em baixo,
  // fica lixo no bucket, o que é bem melhor do que recusar apagar o pagamento
  // ou deixar linhas a apontar para objetos já removidos.
  for (const document of documents) {
    try {
      await storage.delete(document.storageKey, document.storageProvider);
    } catch (error) {
      logger.warn(
        `Pagamento ${paymentId} apagado, mas o ficheiro ${document.storageKey} ficou no storage: ${
          (error as Error).message
        }`,
      );
    }
  }
}

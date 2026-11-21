import { BadRequestException, ConflictException, NotFoundException } from '@nestjs/common';
import { PrismaCompanyPaymentRepository } from '../repositories/prisma/prisma-company-payment-repository';
import { PrismaCompanyRepository } from 'src/company/repositories/prisma/prisma-company-repository';
import { PrismaCompanySupplierRepository } from 'src/company-supplier/repositories/prisma/prisma-company-supplier-repository';
import { PrismaBankAccountRepository } from 'src/bank-account/repositories/prisma/prisma-bank-account-repository';
import { PrismaCompanyItemRepository } from 'src/company-item/repositories/prisma/prisma-company-item-repository';
import { PrismaCompanyStockRepository } from 'src/company-stock/repositories/prisma/prisma-company-stock-repository';
import { PrismaCompanyAssetRepository } from 'src/company-asset/repositories/prisma/prisma-company-asset-repository';
import { assertCompanyAccess } from 'src/company/helpers/assertCompanyAccess';
import { calculateStockBalance } from 'src/company-stock/helpers/calculateStockBalance';
import { UpdateCompanyPaymentDto } from '../dto/update-company-payment.dto';
import { derivePaymentEffects } from './derivePaymentEffects';
import { PaymentRateLookup, resolvePaymentRate } from './resolvePaymentRate';

export async function updateCompanyPayment(
  userId: string,
  companyId: string,
  paymentId: string,
  dto: UpdateCompanyPaymentDto,
  companyPaymentRepository: PrismaCompanyPaymentRepository,
  companyRepository: PrismaCompanyRepository,
  companySupplierRepository: PrismaCompanySupplierRepository,
  bankAccountRepository: PrismaBankAccountRepository,
  companyItemRepository: PrismaCompanyItemRepository,
  stockRepository: PrismaCompanyStockRepository,
  assetRepository: PrismaCompanyAssetRepository,
  rateLookup: PaymentRateLookup,
) {
  const company = await assertCompanyAccess(
    userId,
    companyId,
    companyRepository,
    {
      notYours: 'Não podes editar pagamentos de uma empresa que não é tua',
      permission: 'payments.edit',
    },
  );

  const payment = await companyPaymentRepository.findByIdWithItems(paymentId);

  // Sem o segundo teste, quem soubesse o id editava o pagamento de outra
  // empresa através de uma empresa sua
  if (!payment || payment.companyId !== companyId) {
    throw new NotFoundException('Pagamento não encontrado');
  }

  // --- validação do que vem por referência ---------------------------------
  if (dto.supplierId) {
    const supplier = await companySupplierRepository.findById(dto.supplierId);

    if (!supplier || supplier.companyId !== companyId) {
      throw new BadRequestException('O fornecedor não pertence a esta empresa');
    }
  }

  const assertAccount = async (bankAccountId: string, field: string) => {
    const account = await bankAccountRepository.findById(bankAccountId);

    if (!account || account.companyId !== companyId) {
      throw new BadRequestException(`A conta bancária de ${field} não pertence a esta empresa`);
    }

    // Como ao criar: na moeda do pagamento ou na da empresa, senão o saldo dela não se sabe
    if (account.currencyId !== payment.currencyId && account.currencyId !== company.currencyId) {
      throw new BadRequestException(
        `A conta bancária de ${field} não está na moeda do pagamento nem na da empresa`,
      );
    }
  };

  if (dto.fromBankAccountId) await assertAccount(dto.fromBankAccountId, 'origem');
  if (dto.toBankAccountId) await assertAccount(dto.toBankAccountId, 'destino');

  // --- o que muda de estado ------------------------------------------------
  const wasSettled = payment.status === 'completed';
  const willBeSettled = (dto.status ?? payment.status) === 'completed';

  const paymentDate = dto.paymentDate ? new Date(dto.paymentDate) : payment.paymentDate;

  // --- a taxa para a moeda da empresa ---------------------------------------
  // Muda quando se escreve o valor do extrato, quando se volta à cotação do
  // dia, ou quando um pagamento à cotação do dia muda de dia. Um valor manual
  // fica como está mesmo que a data mude: é o que o banco cobrou.
  const sameCurrency = payment.currencyId === company.currencyId;

  if (sameCurrency && (dto.companyAmount !== undefined || dto.useMarketRate)) {
    throw new BadRequestException(
      'O pagamento já está na moeda da empresa — o valor nela é o próprio valor',
    );
  }

  if (dto.companyAmount !== undefined && dto.useMarketRate) {
    throw new BadRequestException(
      'Ou o valor na moeda da empresa, ou a cotação do dia — não os dois',
    );
  }

  const dateChanged = paymentDate.getTime() !== payment.paymentDate.getTime();
  const wantsMarket =
    dto.useMarketRate || (dateChanged && payment.rateSource === 'market');

  const rate =
    !sameCurrency && (dto.companyAmount !== undefined || wantsMarket)
      ? await resolvePaymentRate(
          payment.currencyId,
          company.currencyId,
          Number(payment.amount),
          paymentDate,
          dto.companyAmount,
          rateLookup,
        )
      : null;

  const oldRate = Number(payment.exchangeRate);
  const newRate = rate?.exchangeRate ?? oldRate;

  // Deixar de estar concluído desfaz o que a compra tinha deixado. As mesmas
  // travas do apagar: um ativo é uma ficha em que se trabalha, e stock que já
  // foi gasto não se pode tirar de baixo dos pés de quem o gastou.
  if (wasSettled && !willBeSettled) {
    const assets = await assetRepository.findAllByPaymentId(paymentId);

    if (assets.length > 0) {
      const names = assets.map((asset) => `"${asset.name}"`).join(', ');

      throw new BadRequestException(
        `Esta compra abriu a ficha de ${names} — apaga o ativo antes de a tirar de concluída`,
      );
    }

    const movements = await stockRepository.findAllByPaymentId(paymentId);

    for (const itemId of new Set(movements.map((movement) => movement.itemId))) {
      const all = await stockRepository.findAllByItemId(companyId, itemId);
      const [without] = calculateStockBalance(all.filter((row) => row.paymentId !== paymentId));

      if (without && without.quantity < 0) {
        const unit = without.stockUnit ? ` ${without.stockUnit}` : '';

        throw new BadRequestException(
          `Sem esta compra, "${without.itemName}" ficava a ${without.quantity}${unit} — o stock que ela trouxe já foi gasto`,
        );
      }
    }
  }

  // Passar a concluído é o momento em que a compra deixa rasto: é agora que se
  // conta o stock e se abrem as fichas, não quando o rascunho foi escrito
  const effects =
    !wasSettled && willBeSettled
      ? await derivePaymentEffects(
          companyId,
          payment.paymentType,
          // Na moeda da empresa, à taxa com que o pagamento fica
          payment.items.map((line) => ({
            itemId: line.itemId,
            quantity: Number(line.quantity),
            unitPrice: Number(line.unitPrice) * newRate,
          })),
          companyItemRepository,
          stockRepository,
        )
      : null;

  // Passar a concluído (de rascunho ou de cancelado) um período de salário: tem de continuar
  // por pagar, e o repositório confirma-o com o trinco do período
  const becameSettled = !wasSettled && willBeSettled;
  if (becameSettled && payment.memberId && payment.memberPayId) {
    const pay = await companyPaymentRepository.findMemberPay(payment.memberId, payment.memberPayId);
    if (!pay || pay.status !== 'accepted') {
      throw new BadRequestException('Este salário não está aceite pelo membro: não se pode pagar');
    }
  }

  const memberPeriod =
    becameSettled && payment.memberPayId && payment.memberPayPeriod
      ? { memberPayId: payment.memberPayId, period: payment.memberPayPeriod }
      : undefined;

  const updated = await companyPaymentRepository.updateWithEffects(paymentId, {
    memberPeriod,
    data: {
      description: dto.description,
      reference: dto.reference,
      paymentDate: dto.paymentDate ? paymentDate : undefined,
      status: dto.status,
      supplierId: dto.supplierId,
      fromBankAccountId: dto.fromBankAccountId,
      toBankAccountId: dto.toBankAccountId,
      exchangeRate: rate?.exchangeRate,
      rateSource: rate?.rateSource,
    },
    // Concluído antes e depois, com outra taxa: o stock e os ativos que a
    // compra criou acompanham
    rescale:
      wasSettled && willBeSettled && rate && oldRate > 0 && newRate !== oldRate
        ? newRate / oldRate
        : undefined,
    // Os movimentos aconteceram quando o pagamento aconteceu: mudar a data dele
    // sem mudar a deles deixava o stock a contar noutro dia
    occurredAt: dto.paymentDate ? paymentDate : undefined,
    // Deixou de estar concluído: o rasto sai
    clearEffects: wasSettled && !willBeSettled,
    // Passou a concluído: o rasto entra
    effects,
    // Os ativos contam-se na moeda da empresa
    currencyId: company.currencyId,
  });

  if (!updated) {
    throw new ConflictException('Esse período já está pago noutro pagamento');
  }

  return { payment: updated, becameSettled };
}

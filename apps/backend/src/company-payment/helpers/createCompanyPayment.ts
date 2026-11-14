import {
  BadRequestException,
  ConflictException,
  ForbiddenException,
  NotFoundException,
} from '@nestjs/common';
import { PrismaCompanyPaymentRepository } from '../repositories/prisma/prisma-company-payment-repository';
import { assertCompanyAccess } from 'src/company/helpers/assertCompanyAccess';
import { PrismaCompanyRepository } from 'src/company/repositories/prisma/prisma-company-repository';
import { PrismaCompanySupplierRepository } from 'src/company-supplier/repositories/prisma/prisma-company-supplier-repository';
import { PrismaBankAccountRepository } from 'src/bank-account/repositories/prisma/prisma-bank-account-repository';
import { PrismaTaxRepository } from 'src/tax/repositories/prisma/prisma-tax-repository';
import { PrismaCompanyItemRepository } from 'src/company-item/repositories/prisma/prisma-company-item-repository';
import { PrismaCompanyStockRepository } from 'src/company-stock/repositories/prisma/prisma-company-stock-repository';
import { CreateCompanyPaymentDto } from '../dto/create-company-payment.dto';
import {
  calculatePaymentTaxes,
  deriveBaseFromGross,
  sumTaxAmounts,
} from './calculatePaymentTaxes';
import { derivePaymentEffects } from './derivePaymentEffects';
import { PaymentRateLookup, resolvePaymentRate } from './resolvePaymentRate';

// Dinheiro fica sempre com 2 casas: quantidade × preço em floats dá restos
// como 90.00000000000001 e o total tem de ser um valor limpo
const roundMoney = (value: number) => Math.round(value * 100) / 100;

export async function createCompanyPayment(
  userId: string,
  companyId: string,
  dto: CreateCompanyPaymentDto,
  companyPaymentRepository: PrismaCompanyPaymentRepository,
  companyRepository: PrismaCompanyRepository,
  companySupplierRepository: PrismaCompanySupplierRepository,
  bankAccountRepository: PrismaBankAccountRepository,
  taxRepository: PrismaTaxRepository,
  companyItemRepository: PrismaCompanyItemRepository,
  stockRepository: PrismaCompanyStockRepository,
  rateLookup: PaymentRateLookup,
) {
  // 1. A empresa tem de existir e pertencer a quem está a pedir
  const company = await assertCompanyAccess(
    userId,
    companyId,
    companyRepository,
    {
      notYours: 'Não podes registar pagamentos numa empresa que não é tua',
      permission: 'payments.create',
    },
  );

  // 2. A moeda do pagamento: a que vier, ou a da empresa. Noutra moeda, o
  // pagamento guarda a taxa com que passa para a da empresa (passo 11).
  const currencyId = dto.currencyId ?? company.currencyId;

  if (currencyId !== company.currencyId) {
    const currency = await rateLookup.currencyRepository.findById(currencyId);

    if (!currency) {
      throw new BadRequestException('Moeda inválida');
    }
  } else if (dto.companyAmount !== undefined) {
    throw new BadRequestException(
      'O pagamento já está na moeda da empresa — o valor nela é o próprio valor',
    );
  }

  // 3. As contas bancárias que vierem têm de existir e ser da empresa. E têm de
  // estar na moeda do pagamento ou na da empresa: é numa dessas que se sabe
  // quanto saiu da conta (o valor, ou o valor × a taxa).
  const assertBankAccountBelongsToCompany = async (
    bankAccountId: string,
    field: string,
  ) => {
    const bankAccount = await bankAccountRepository.findById(bankAccountId);

    if (!bankAccount) {
      throw new BadRequestException(`Conta bancária inválida (${field})`);
    }

    if (bankAccount.companyId !== companyId) {
      throw new BadRequestException(
        `A conta bancária de ${field} não pertence a esta empresa`,
      );
    }

    if (
      bankAccount.currencyId !== currencyId &&
      bankAccount.currencyId !== company.currencyId
    ) {
      throw new BadRequestException(
        `A conta bancária de ${field} não está na moeda do pagamento nem na da empresa`,
      );
    }
  };

  if (dto.fromBankAccountId) {
    await assertBankAccountBelongsToCompany(dto.fromBankAccountId, 'origem');
  }

  if (dto.toBankAccountId) {
    await assertBankAccountBelongsToCompany(dto.toBankAccountId, 'destino');
  }

  // 4. Cada tipo de pagamento exige contas diferentes
  if (dto.paymentType === 'pay' && !dto.fromBankAccountId) {
    throw new BadRequestException(
      'Um pagamento a pagar precisa de conta de origem',
    );
  }

  if (dto.paymentType === 'receive' && !dto.toBankAccountId) {
    throw new BadRequestException('Um recebimento precisa de conta de destino');
  }

  if (dto.paymentType === 'internal_transfer') {
    if (!dto.fromBankAccountId || !dto.toBankAccountId) {
      throw new BadRequestException(
        'Uma transferência interna precisa de conta de origem e de destino',
      );
    }

    if (dto.fromBankAccountId === dto.toBankAccountId) {
      throw new BadRequestException(
        'A conta de origem e de destino não podem ser a mesma',
      );
    }
  }

  // 5. Se a contraparte é um fornecedor, tem de vir identificado e ser da empresa
  if (dto.partyType === 'supplier') {
    if (!dto.supplierId) {
      throw new BadRequestException('Tens de indicar o fornecedor');
    }

    const supplier = await companySupplierRepository.findById(dto.supplierId);

    if (!supplier) {
      throw new NotFoundException('Fornecedor não encontrado');
    }

    if (supplier.companyId !== companyId) {
      throw new BadRequestException('O fornecedor não pertence a esta empresa');
    }
  }

  // 5b. Um membro (salário, recibo verde) tem de ser desta empresa. Vindo dos
  // próximos pagamentos traz o salário e o período, que não se paga duas vezes.
  if (dto.partyType === 'member') {
    if (!dto.memberId) {
      throw new BadRequestException('Tens de indicar o membro');
    }

    if (!(await companyPaymentRepository.findMember(companyId, dto.memberId))) {
      throw new NotFoundException('Membro não encontrado');
    }

    if (dto.memberPayId) {
      const pay = await companyPaymentRepository.findMemberPay(dto.memberId, dto.memberPayId);

      if (!pay) {
        throw new NotFoundException('Salário ou recibo verde não encontrado');
      }

      const validPeriod =
        pay.kind === 'freelance'
          ? dto.memberPayPeriod === 'once'
          : /^\d{4}-(0[1-9]|1[0-2])(:holiday|:christmas)?$/.test(dto.memberPayPeriod ?? '');

      if (!validPeriod) {
        throw new BadRequestException('O período pago não é válido');
      }

      if (await companyPaymentRepository.findPaidMemberPeriod(pay.id, dto.memberPayPeriod!)) {
        throw new ConflictException('Esse pagamento já está registado');
      }
    }
  } else if (dto.memberId || dto.memberPayId) {
    throw new BadRequestException('Só um pagamento a um membro leva o membro');
  }

  // 6. As linhas de item têm de ser de itens desta empresa, e o total de cada
  // linha é calculado aqui — nunca aceite do cliente
  const itemLines: {
    itemId: string;
    quantity: number;
    unitPrice: number;
    totalPrice: number;
  }[] = [];

  for (const line of dto.items ?? []) {
    const item = await companyItemRepository.findById(line.itemId);

    if (!item) {
      throw new BadRequestException(`Item inválido: "${line.itemId}"`);
    }

    if (item.companyId !== companyId) {
      throw new BadRequestException('O item não pertence a esta empresa');
    }

    itemLines.push({
      itemId: line.itemId,
      quantity: line.quantity,
      unitPrice: line.unitPrice,
      totalPrice: roundMoney(line.quantity * line.unitPrice),
    });
  }

  // 7. A base é o valor sem imposto: com linhas de item é a soma delas, senão é
  // o que vier no `baseAmount`. Sem impostos, a base é o próprio `amount`.
  const hasItemLines = itemLines.length > 0;
  const typedTotal = hasItemLines
    ? roundMoney(itemLines.reduce((sum, line) => sum + line.totalPrice, 0))
    : roundMoney(dto.baseAmount ?? dto.amount);

  let baseAmount = typedTotal;

  // 8. Se os preços escritos já traziam imposto, faz-se a conta ao contrário e
  // as linhas são convertidas para valores sem imposto. Fica tudo guardado sem
  // imposto, venha como vier — senão dois pagamentos iguais ficavam com
  // valores diferentes só por causa de como foram escritos.
  if (dto.pricesIncludeTax && dto.taxes && dto.taxes.length > 0) {
    const exactBase = await deriveBaseFromGross(
      typedTotal,
      dto.taxes,
      taxRepository,
    );

    baseAmount = roundMoney(exactBase);

    if (hasItemLines) {
      // Todas as linhas encolhem na mesma proporção, medida sem arredondar
      const ratio = typedTotal === 0 ? 0 : exactBase / typedTotal;

      for (const line of itemLines) {
        line.unitPrice = line.unitPrice * ratio;
        line.totalPrice = roundMoney(line.quantity * line.unitPrice);
      }

      // Arredondar linha a linha deixa a soma a um ou dois cêntimos da base.
      // A diferença vai para a última linha, como se faz numa fatura, senão o
      // detalhe deixava de explicar o total.
      const linesSum = roundMoney(
        itemLines.reduce((sum, line) => sum + line.totalPrice, 0),
      );
      const difference = roundMoney(baseAmount - linesSum);

      if (difference !== 0) {
        const last = itemLines[itemLines.length - 1];

        last.totalPrice = roundMoney(last.totalPrice + difference);
        // O preço unitário acompanha, para a linha continuar a bater consigo mesma
        last.unitPrice =
          last.quantity === 0
            ? last.unitPrice
            : last.totalPrice / last.quantity;
      }
    }
  }

  // 9. Os impostos são calculados sobre a base — o cliente manda que impostos
  // se aplicam, nunca quanto é que eles dão
  const taxLines = await calculatePaymentTaxes(
    baseAmount,
    dto.taxes ?? [],
    taxRepository,
  );
  const taxesTotal = sumTaxAmounts(taxLines);

  // 10. O valor do pagamento é o que sai do banco: base + impostos. Divergir em
  // silêncio deixava um pagamento cujo total não explica as próprias linhas.
  const expectedAmount = roundMoney(baseAmount + taxesTotal);

  if (Math.abs(roundMoney(dto.amount) - expectedAmount) > 0.01) {
    throw new BadRequestException(
      hasItemLines || taxLines.length > 0
        ? `O valor do pagamento (${dto.amount}) não corresponde à base (${baseAmount}) mais os impostos (${taxesTotal})`
        : `O valor do pagamento (${dto.amount}) não corresponde ao valor sem imposto (${baseAmount})`,
    );
  }

  // 11. A taxa para a moeda da empresa, fixada agora: a do extrato, se veio,
  // senão a cotação do dia. Tudo o que o pagamento cria usa esta.
  const paymentDate = new Date(dto.paymentDate);
  const { exchangeRate, rateSource } = await resolvePaymentRate(
    currencyId,
    company.currencyId,
    dto.amount,
    paymentDate,
    dto.companyAmount,
    rateLookup,
  );

  // 12. O que as linhas deixam atrás de si — stock e imobilizado — vem do
  // helper partilhado com o PATCH, que é quem sabe ler o `kind` do item. Já
  // sem imposto (passo 8) e na moeda da empresa: o stock e os ativos contam-se
  // nela.
  //
  // Um rascunho ou um pagamento cancelado é uma intenção, não um facto: não
  // mexe no inventário nem abre ficha de ativo. Passar a concluído mais tarde
  // é que produz esse rasto, e é o PATCH que trata disso.
  const isSettled = (dto.status ?? 'completed') === 'completed';

  const { stockMovements, assets } = isSettled
    ? await derivePaymentEffects(
        companyId,
        dto.paymentType,
        itemLines.map((line) => ({
          ...line,
          unitPrice: line.unitPrice * exchangeRate,
        })),
        companyItemRepository,
        stockRepository,
      )
    : { stockMovements: [], assets: [] };

  // 13. Criar pagamento + linhas de imposto + linhas de item
  return companyPaymentRepository.createWithLines({
    companyId,
    paymentType: dto.paymentType,
    partyType: dto.partyType,
    supplierId: dto.supplierId,
    memberId: dto.partyType === 'member' ? dto.memberId : undefined,
    memberPayId: dto.partyType === 'member' ? dto.memberPayId : undefined,
    memberPayPeriod:
      dto.partyType === 'member' && dto.memberPayId ? dto.memberPayPeriod : undefined,
    fromBankAccountId: dto.fromBankAccountId,
    toBankAccountId: dto.toBankAccountId,
    amount: dto.amount,
    currencyId,
    exchangeRate,
    rateSource,
    description: dto.description,
    reference: dto.reference,
    paymentDate,
    status: dto.status,
    taxes: taxLines,
    items: itemLines,
    // Vazios enquanto o pagamento não estiver concluído
    stockMovements: isSettled ? stockMovements : [],
    assets: isSettled ? assets : [],
    companyCurrencyId: company.currencyId,
  });
}

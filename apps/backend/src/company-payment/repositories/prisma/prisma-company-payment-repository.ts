import { Injectable } from '@nestjs/common';
import { PrismaService } from 'src/prisma/prisma.service';
import {
  CompanyAssetInput,
  CompanyPaymentChange,
  CompanyPaymentItemInput,
  CompanyPaymentRepository,
  CompanyPaymentTaxInput,
  CompanyPaymentWithLines,
  CompanyStockMovementInput,
  MonthlyTotalsFilters,
  PaginatedCompanyPayments,
} from '../company-payment-repository';
import {
  CompanyMember,
  CompanyMemberPay,
  CompanyPayment,
} from 'src/generated/prisma/client/client';

@Injectable()
export class PrismaCompanyPaymentRepository implements CompanyPaymentRepository {
  constructor(private readonly prisma: PrismaService) {}

  async createWithLines(data: {
    companyId: string;
    paymentType: string;
    partyType: string;
    supplierId?: string;
    memberId?: string;
    memberPayId?: string;
    memberPayPeriod?: string;
    fromBankAccountId?: string;
    toBankAccountId?: string;
    amount: number;
    currencyId: string;
    exchangeRate: number;
    rateSource: string;
    description?: string;
    reference?: string;
    paymentDate: Date;
    status?: string;
    taxes: CompanyPaymentTaxInput[];
    items: CompanyPaymentItemInput[];
    // Derivados das linhas: uma linha de um item `stock` dá entrada em stock,
    // uma de um item `asset` cria um registo de imobilizado. Entram na mesma
    // transação para não haver pagamento sem o seu reflexo.
    stockMovements: CompanyStockMovementInput[];
    assets: CompanyAssetInput[];
    companyCurrencyId: string;
  }): Promise<CompanyPaymentWithLines> {
    const {
      taxes,
      items,
      stockMovements,
      assets,
      companyCurrencyId,
      ...payment
    } = data;

    // Pagamento, impostos, itens, movimentos de stock e ativos são criados
    // juntos — tudo ou nada
    return this.prisma.companyPayment.create({
      data: {
        ...payment,
        taxes: {
          create: taxes.map((tax) => ({
            taxId: tax.taxId,
            calculationType: tax.calculationType,
            rate: tax.rate,
            netAmount: tax.netAmount ?? 0,
            taxAmount: tax.taxAmount ?? 0,
            totalAmount: tax.totalAmount ?? 0,
          })),
        },
        items: {
          create: items.map((item) => ({
            itemId: item.itemId,
            quantity: item.quantity,
            unitPrice: item.unitPrice,
            totalPrice: item.totalPrice,
          })),
        },
        stockMovements: {
          create: stockMovements.map((movement) => ({
            companyId: payment.companyId,
            itemId: movement.itemId,
            type: movement.type,
            quantity: movement.quantity,
            unitCost: movement.unitCost,
            sourceType: 'payment',
            occurredAt: payment.paymentDate,
          })),
        },
        assets: {
          create: assets.map((asset) => ({
            companyId: payment.companyId,
            itemId: asset.itemId,
            name: asset.name,
            category: asset.category,
            acquisitionDate: payment.paymentDate,
            acquisitionValue: asset.acquisitionValue,
            // O ativo conta-se na moeda da empresa, venha a compra na que vier
            currencyId: companyCurrencyId,
            depreciationRate: asset.depreciationRate,
          })),
        },
      },
      include: { taxes: true, items: true },
    });
  }

  async findByIdWithItems(id: string) {
    return this.prisma.companyPayment.findUnique({ where: { id }, include: { items: true } });
  }

  /**
   * Alterar um pagamento e, se for caso disso, o rasto que ele deixou.
   *
   * Tudo numa transação: um pagamento que passa a concluído sem o stock a
   * acompanhar — ou ao contrário — seria pior do que a alteração não ter
   * acontecido de todo.
   */
  async updateWithEffects(
    id: string,
    change: CompanyPaymentChange,
  ): Promise<CompanyPaymentWithLines> {
    return this.prisma.$transaction(async (tx) => {
      if (change.clearEffects) {
        await tx.companyStockMovement.deleteMany({ where: { paymentId: id } });
      }

      const payment = await tx.companyPayment.update({
        where: { id },
        data: change.data,
        include: { taxes: true, items: true },
      });

      // Outra taxa: o que a compra criou passa a valer na nova. Só as entradas
      // de stock — o custo de uma saída é o médio do momento, não o da compra.
      if (change.rescale !== undefined && change.rescale !== 1) {
        const factor = change.rescale.toString();

        await tx.$executeRaw`
          UPDATE "CompanyStockMovement"
             SET "unitCost" = ROUND("unitCost" * ${factor}::numeric, 4)
           WHERE "paymentId" = ${id} AND type = 'in' AND "unitCost" IS NOT NULL`;
        await tx.$executeRaw`
          UPDATE "CompanyAsset"
             SET "acquisitionValue" = ROUND("acquisitionValue" * ${factor}::numeric, 2)
           WHERE "paymentId" = ${id}`;
      }

      // A data dos movimentos segue a do pagamento: eles aconteceram quando
      // ele aconteceu
      if (change.occurredAt) {
        await tx.companyStockMovement.updateMany({
          where: { paymentId: id },
          data: { occurredAt: change.occurredAt },
        });
      }

      if (change.effects) {
        for (const movement of change.effects.stockMovements) {
          await tx.companyStockMovement.create({
            data: {
              companyId: payment.companyId,
              itemId: movement.itemId,
              type: movement.type,
              quantity: movement.quantity,
              unitCost: movement.unitCost,
              sourceType: 'payment',
              paymentId: id,
              occurredAt: payment.paymentDate,
            },
          });
        }

        for (const asset of change.effects.assets) {
          await tx.companyAsset.create({
            data: {
              companyId: payment.companyId,
              paymentId: id,
              itemId: asset.itemId,
              name: asset.name,
              category: asset.category,
              acquisitionDate: payment.paymentDate,
              acquisitionValue: asset.acquisitionValue,
              currencyId: change.currencyId,
              depreciationRate: asset.depreciationRate,
            },
          });
        }
      }

      return payment;
    });
  }

  async findById(id: string): Promise<CompanyPayment | null> {
    return this.prisma.companyPayment.findUnique({ where: { id } });
  }

  // Quem apaga o pagamento precisa de saber que ficheiros ficam órfãos no
  // bucket para os poder remover de lá também
  async findDocuments(paymentId: string) {
    return this.prisma.companyPaymentDocument.findMany({
      where: { paymentId },
      select: { storageKey: true, storageProvider: true },
    });
  }

  // As linhas apontam para o pagamento com FK obrigatória, por isso saem
  // primeiro. Tudo na mesma transação — meio pagamento apagado era pior do que
  // nenhum.
  async delete(id: string): Promise<void> {
    await this.prisma.$transaction([
      this.prisma.companyPaymentItem.deleteMany({ where: { paymentId: id } }),
      this.prisma.companyPaymentTax.deleteMany({ where: { paymentId: id } }),
      this.prisma.companyPaymentDocument.deleteMany({ where: { paymentId: id } }),
      // O stock que a compra trouxe vai atrás dela: uma quantidade sem a compra
      // que a explica não é informação nenhuma. A FK é RESTRICT, por isso sem
      // isto o delete falhava.
      //
      // Os ativos NÃO saem aqui, de propósito: o helper recusa apagar a compra
      // enquanto eles existirem. Se algum escapasse, a FK rebentava a transação
      // — ruidoso, mas muito melhor do que deitar fora a ficha da máquina.
      this.prisma.companyStockMovement.deleteMany({ where: { paymentId: id } }),
      this.prisma.companyPayment.delete({ where: { id } }),
    ]);
  }

  // A página e a contagem saem na mesma transação: com dois pedidos soltos, um
  // pagamento criado a meio deixava o total a não bater com o que se mostra
  // Os pagos e recebidos desde uma data, com os filtros do gráfico: só o que as
  // contas por mês precisam (as transferências internas ficam de fora)
  async findForMonthlyTotals(companyId: string, filters: MonthlyTotalsFilters) {
    return this.prisma.companyPayment.findMany({
      where: {
        companyId,
        paymentType: { in: ['pay', 'receive'] },
        status: { in: filters.statuses },
        paymentDate: { gte: filters.from, lte: filters.until },
        ...(filters.supplierId ? { supplierId: filters.supplierId } : {}),
        ...(filters.supplierGroupId
          ? { supplier: { groupId: filters.supplierGroupId } }
          : {}),
      },
      select: {
        amount: true,
        exchangeRate: true,
        paymentDate: true,
        paymentType: true,
      },
    });
  }

  async findMember(companyId: string, memberId: string): Promise<CompanyMember | null> {
    return this.prisma.companyMember.findFirst({ where: { id: memberId, companyId } });
  }

  async findMemberPay(memberId: string, memberPayId: string): Promise<CompanyMemberPay | null> {
    return this.prisma.companyMemberPay.findFirst({ where: { id: memberPayId, memberId } });
  }

  async findPaidMemberPeriod(memberPayId: string, period: string): Promise<CompanyPayment | null> {
    return this.prisma.companyPayment.findFirst({
      where: { memberPayId, memberPayPeriod: period, status: { not: 'cancelled' } },
    });
  }

  async findAllByCompanyId(
    companyId: string,
    pagination: { skip: number; take: number },
  ): Promise<PaginatedCompanyPayments> {
    const [items, total] = await this.prisma.$transaction([
      this.prisma.companyPayment.findMany({
        where: { companyId },
        orderBy: { paymentDate: 'desc' },
        skip: pagination.skip,
        take: pagination.take,
        include: {
          supplier: true,
          member: { select: { id: true, name: true, user: { select: { fullName: true } } } },
          currency: true,
          fromBankAccount: true,
          toBankAccount: true,
          taxes: { include: { tax: true } },
          // O nome do item vive na tabela dele — sem isto a linha era só um uuid
          items: { include: { item: true } },
        },
      }),
      this.prisma.companyPayment.count({ where: { companyId } }),
    ]);

    return { items, total };
  }
}

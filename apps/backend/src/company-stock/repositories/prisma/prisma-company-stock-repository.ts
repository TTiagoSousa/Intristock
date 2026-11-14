import { Injectable } from '@nestjs/common';
import { PrismaService } from 'src/prisma/prisma.service';
import {
  CompanyStockRepository,
  StockMovementData,
  StockMovementWithItem,
} from '../company-stock-repository';
import { CompanyStockMovement } from 'src/generated/prisma/client/client';

const movementInclude = {
  item: { select: { id: true, name: true, stockUnit: true } },
};

@Injectable()
export class PrismaCompanyStockRepository implements CompanyStockRepository {
  constructor(private readonly prisma: PrismaService) {}

  async create(data: StockMovementData): Promise<StockMovementWithItem> {
    return this.prisma.companyStockMovement.create({
      data: data as never,
      include: movementInclude,
    });
  }

  async createMany(data: StockMovementData[]): Promise<number> {
    const result = await this.prisma.companyStockMovement.createMany({ data: data as never });
    return result.count;
  }

  async findById(id: string): Promise<CompanyStockMovement | null> {
    return this.prisma.companyStockMovement.findUnique({ where: { id } });
  }

  /**
   * Uma página da lista, mais o total que existe.
   *
   * As duas coisas na mesma transação: com dois pedidos soltos, uma linha
   * criada a meio deixava o total a não bater com o que se mostra.
   */
  async findPageByCompanyId(
    companyId: string,
    pagination: { skip: number; take: number },
    itemId?: string,
  ) {
    const where = itemId ? { companyId, itemId } : { companyId };

    const [items, total] = await this.prisma.$transaction([
      this.prisma.companyStockMovement.findMany({
        where,
        include: movementInclude,
        orderBy: [{ occurredAt: 'desc' }, { createdAt: 'desc' }],
        skip: pagination.skip,
        take: pagination.take,
      }),
      this.prisma.companyStockMovement.count({ where }),
    ]);

    return { items, total };
  }

  async findAllByCompanyId(companyId: string): Promise<StockMovementWithItem[]> {
    return this.prisma.companyStockMovement.findMany({
      where: { companyId },
      include: movementInclude,
      orderBy: [{ occurredAt: 'desc' }, { createdAt: 'desc' }],
    });
  }

  async findAllByItemId(companyId: string, itemId: string): Promise<StockMovementWithItem[]> {
    return this.prisma.companyStockMovement.findMany({
      where: { companyId, itemId },
      include: movementInclude,
      orderBy: [{ occurredAt: 'desc' }, { createdAt: 'desc' }],
    });
  }

  // Usado antes de apagar o pagamento, para saber que itens é que ele mexeu
  async findAllByPaymentId(paymentId: string): Promise<StockMovementWithItem[]> {
    return this.prisma.companyStockMovement.findMany({
      where: { paymentId },
      include: movementInclude,
    });
  }

  // Usado quando o pagamento que gerou os movimentos é apagado
  async deleteByPayment(paymentId: string): Promise<void> {
    await this.prisma.companyStockMovement.deleteMany({ where: { paymentId } });
  }

  async delete(id: string): Promise<void> {
    await this.prisma.companyStockMovement.delete({ where: { id } });
  }
}

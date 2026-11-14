import { Injectable } from '@nestjs/common';
import { PrismaService } from 'src/prisma/prisma.service';
import {
  CompanyAssetData,
  CompanyAssetRepository,
  CompanyAssetWithRelations,
} from '../company-asset-repository';
import { CompanyAsset } from 'src/generated/prisma/client/client';

const assetInclude = {
  currency: { select: { id: true, shortCode: true, symbol: true } },
  item: { select: { id: true, name: true } },
  payment: { select: { id: true, reference: true, paymentDate: true } },
};

@Injectable()
export class PrismaCompanyAssetRepository implements CompanyAssetRepository {
  constructor(private readonly prisma: PrismaService) {}

  async create(
    data: CompanyAssetData & { companyId: string },
  ): Promise<CompanyAssetWithRelations> {
    return this.prisma.companyAsset.create({
      data: data as never,
      include: assetInclude,
    });
  }

  async update(id: string, data: CompanyAssetData): Promise<CompanyAssetWithRelations> {
    return this.prisma.companyAsset.update({
      where: { id },
      data: data as never,
      include: assetInclude,
    });
  }

  async findById(id: string): Promise<CompanyAsset | null> {
    return this.prisma.companyAsset.findUnique({ where: { id } });
  }

  /**
   * Uma página da lista, mais o total que existe.
   *
   * As duas coisas na mesma transação: com dois pedidos soltos, uma linha
   * criada a meio deixava o total a não bater com o que se mostra.
   */
  async findPageByCompanyId(companyId: string, pagination: { skip: number; take: number }) {
    const [items, total] = await this.prisma.$transaction([
      this.prisma.companyAsset.findMany({
        where: { companyId },
        orderBy: { acquisitionDate: 'desc' },
        skip: pagination.skip,
        take: pagination.take,
        include: assetInclude,
      }),
      this.prisma.companyAsset.count({ where: { companyId } }),
    ]);

    return { items, total };
  }

  async findAllByCompanyId(companyId: string): Promise<CompanyAssetWithRelations[]> {
    return this.prisma.companyAsset.findMany({
      where: { companyId },
      include: assetInclude,
      orderBy: { acquisitionDate: 'desc' },
    });
  }

  // Usado antes de apagar um pagamento: uma compra não se apaga enquanto os
  // ativos que gerou existirem
  async findAllByPaymentId(paymentId: string): Promise<CompanyAsset[]> {
    return this.prisma.companyAsset.findMany({ where: { paymentId } });
  }

  // A compra de origem de um ativo. Lida daqui, e não pelo repositório dos
  // pagamentos, para não fechar um ciclo entre os dois módulos.
  async findPaymentInCompany(paymentId: string, companyId: string) {
    return this.prisma.companyPayment.findFirst({
      where: { id: paymentId, companyId },
      select: { id: true },
    });
  }

  async delete(id: string): Promise<void> {
    await this.prisma.companyAsset.delete({ where: { id } });
  }
}

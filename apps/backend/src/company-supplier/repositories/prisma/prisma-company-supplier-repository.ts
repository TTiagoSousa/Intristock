import { Injectable } from '@nestjs/common';
import { PrismaService } from 'src/prisma/prisma.service';
import {
  CompanySupplierData,
  CompanySupplierRepository,
} from '../company-supplier-repository';
import { CompanySupplier } from 'src/generated/prisma/client/client';

// O que acompanha um fornecedor quando é lido: as relações que a lista e a
// página mostram pelo nome, e os telefones extra
const SUPPLIER_INCLUDE = {
  country: true,
  currency: true,
  bankAccount: true,
  group: { select: { id: true, name: true } },
  // O do catálogo de onde veio (o logótipo e o tipo, para a lista e a página)
  platform: { select: { id: true, name: true, type: true, logo: true } },
  phones: { orderBy: { createdAt: 'asc' as const } },
};

@Injectable()
export class PrismaCompanySupplierRepository implements CompanySupplierRepository {
  constructor(private readonly prisma: PrismaService) {}

  async create(
    data: CompanySupplierData & {
      companyId: string;
      name: string;
      slug: string;
      type: string;
    },
  ): Promise<CompanySupplier> {
    const { phones, ...fields } = data;

    return this.prisma.companySupplier.create({
      data: {
        ...fields,
        phones: phones?.length ? { create: phones } : undefined,
      },
      include: SUPPLIER_INCLUDE,
    });
  }

  async update(
    id: string,
    data: CompanySupplierData,
  ): Promise<CompanySupplier> {
    const { phones, ...fields } = data;

    return this.prisma.companySupplier.update({
      where: { id },
      data: {
        ...fields,
        // A lista vem inteira: os números que não vierem foram apagados
        phones: phones ? { deleteMany: {}, create: phones } : undefined,
      },
      include: SUPPLIER_INCLUDE,
    });
  }

  async delete(id: string): Promise<void> {
    await this.prisma.companySupplier.delete({ where: { id } });
  }

  async findById(id: string): Promise<CompanySupplier | null> {
    return this.prisma.companySupplier.findUnique({ where: { id } });
  }

  async findBySlug(companyId: string, slug: string) {
    return this.prisma.companySupplier.findUnique({
      where: { companyId_slug: { companyId, slug } },
      include: SUPPLIER_INCLUDE,
    });
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
  ) {
    const [items, total] = await this.prisma.$transaction([
      this.prisma.companySupplier.findMany({
        where: { companyId },
        orderBy: { createdAt: 'desc' },
        skip: pagination.skip,
        take: pagination.take,
        include: SUPPLIER_INCLUDE,
      }),
      this.prisma.companySupplier.count({ where: { companyId } }),
    ]);

    return { items, total };
  }

  async findAllByCompanyId(companyId: string): Promise<CompanySupplier[]> {
    return this.prisma.companySupplier.findMany({
      where: { companyId },
      orderBy: { createdAt: 'desc' },
      include: SUPPLIER_INCLUDE,
    });
  }

  // --- o catálogo: as plataformas de onde se tiram fornecedores ---
  async findCatalogPlatforms(type: string) {
    return this.prisma.platform.findMany({
      where: { type, isActive: true },
      orderBy: { name: 'asc' },
      select: {
        id: true,
        name: true,
        logo: true,
        website: true,
        country: { select: { name: true } },
        propFirm: { select: { countryName: true, score: true } },
      },
    });
  }

  async findPlatform(id: string) {
    return this.prisma.platform.findUnique({ where: { id } });
  }

  // Os fornecedores desta empresa que vieram do catálogo
  async findPlatformLinks(companyId: string) {
    const rows = await this.prisma.companySupplier.findMany({
      where: { companyId, platformId: { not: null } },
      select: { id: true, platformId: true, slug: true },
    });
    return rows as { id: string; platformId: string; slug: string }[];
  }

  async findByPlatform(companyId: string, platformId: string) {
    return this.prisma.companySupplier.findUnique({
      where: { companyId_platformId: { companyId, platformId } },
    });
  }

  // O que impede um fornecedor de ser apagado sem estragar o histórico. As
  // ligações a itens não contam: saem com ele e os itens ficam.
  async countPayments(id: string) {
    return this.prisma.companyPayment.count({ where: { supplierId: id } });
  }
}

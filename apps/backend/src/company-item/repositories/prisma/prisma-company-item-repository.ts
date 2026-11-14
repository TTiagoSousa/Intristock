import { Injectable } from '@nestjs/common';
import { PrismaService } from 'src/prisma/prisma.service';
import {
  CompanyItemData,
  CompanyItemRepository,
  CompanyItemWithRelations,
} from '../company-item-repository';
import { CompanyItem } from 'src/generated/prisma/client/client';

const itemInclude = {
  suppliers: {
    orderBy: { createdAt: 'asc' as const },
    select: { supplier: { select: { id: true, name: true } } },
  },
};

type ItemWithLinks = CompanyItem & {
  suppliers: { supplier: { id: string; name: string } }[];
};

// A ligação é uma tabela à parte; para fora sai só a lista de fornecedores
const flatten = (item: ItemWithLinks): CompanyItemWithRelations => ({
  ...item,
  suppliers: item.suppliers.map((link) => link.supplier),
});

// O que entra no Prisma: os campos do item, e os fornecedores como ligações
const toPrismaData = (
  { supplierIds, ...fields }: CompanyItemData,
  replace: boolean,
) => ({
  ...fields,
  suppliers:
    supplierIds === undefined
      ? undefined
      : {
          // A editar, a lista vem inteira: as ligações que não vierem saem
          ...(replace ? { deleteMany: {} } : {}),
          create: supplierIds.map((supplierId) => ({ supplierId })),
        },
});

@Injectable()
export class PrismaCompanyItemRepository implements CompanyItemRepository {
  constructor(private readonly prisma: PrismaService) {}

  async create(
    data: CompanyItemData & { companyId: string; slug: string },
  ): Promise<CompanyItemWithRelations> {
    const item = await this.prisma.companyItem.create({
      data: toPrismaData(data, false) as never,
      include: itemInclude,
    });

    return flatten(item);
  }

  async update(
    id: string,
    data: CompanyItemData,
  ): Promise<CompanyItemWithRelations> {
    const item = await this.prisma.companyItem.update({
      where: { id },
      data: toPrismaData(data, true) as never,
      include: itemInclude,
    });

    return flatten(item);
  }

  async findById(id: string): Promise<CompanyItem | null> {
    return this.prisma.companyItem.findUnique({ where: { id } });
  }

  // --- o catálogo: os planos de uma plataforma, para virarem itens ---
  async findCatalogPlatform(platformId: string) {
    return this.prisma.platform.findUnique({
      where: { id: platformId },
      select: {
        id: true,
        name: true,
        logo: true,
        source: true,
        isActive: true,
        plans: {
          where: { isActive: true },
          orderBy: [{ step: 'asc' }, { accountSize: 'asc' }],
          select: {
            id: true,
            name: true,
            step: true,
            accountSize: true,
            price: true,
            currency: true,
          },
        },
      },
    });
  }

  // Os itens desta empresa que vieram destes planos
  async findPlanLinks(companyId: string, planIds: string[]) {
    const rows = await this.prisma.companyItem.findMany({
      where: { companyId, platformPlanId: { in: planIds } },
      select: { id: true, slug: true, platformPlanId: true },
    });
    return rows as { id: string; slug: string; platformPlanId: string }[];
  }

  async findNames(companyId: string) {
    const rows = await this.prisma.companyItem.findMany({
      where: { companyId },
      select: { name: true },
    });
    return rows.map((row) => row.name);
  }

  async findSlugs(companyId: string) {
    const rows = await this.prisma.companyItem.findMany({
      where: { companyId },
      select: { slug: true },
    });
    return rows.map((row) => row.slug);
  }

  // Vários itens de uma vez, cada um ligado ao fornecedor: ou todos, ou nenhum
  async createManyFromPlans(
    items: {
      companyId: string;
      platformPlanId: string;
      name: string;
      slug: string;
      type: string;
      kind: string;
      isRecurring: boolean;
      defaultPrice: number | null;
      description: string | null;
      supplierId: string;
    }[],
  ) {
    await this.prisma.$transaction(
      items.map(({ supplierId, ...item }) =>
        this.prisma.companyItem.create({
          data: { ...item, suppliers: { create: [{ supplierId }] } },
        }),
      ),
    );
  }

  async findByCompanyAndName(
    companyId: string,
    name: string,
  ): Promise<CompanyItem | null> {
    return this.prisma.companyItem.findUnique({
      where: { companyId_name: { companyId, name } },
    });
  }

  async findBySlug(
    companyId: string,
    slug: string,
  ): Promise<CompanyItemWithRelations | null> {
    const item = await this.prisma.companyItem.findUnique({
      where: { companyId_slug: { companyId, slug } },
      include: itemInclude,
    });

    return item ? flatten(item) : null;
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
      this.prisma.companyItem.findMany({
        where: { companyId },
        orderBy: { name: 'asc' },
        skip: pagination.skip,
        take: pagination.take,
        include: itemInclude,
      }),
      this.prisma.companyItem.count({ where: { companyId } }),
    ]);

    return { items: items.map(flatten), total };
  }

  async findAllByCompanyId(
    companyId: string,
  ): Promise<CompanyItemWithRelations[]> {
    const items = await this.prisma.companyItem.findMany({
      where: { companyId },
      orderBy: { name: 'asc' },
      include: itemInclude,
    });

    return items.map(flatten);
  }

  // Um item já usado numa compra não pode ser apagado — apagá-lo destruiria
  // o histórico das linhas que lhe apontam
  async countPaymentLines(itemId: string): Promise<number> {
    return this.prisma.companyPaymentItem.count({ where: { itemId } });
  }

  async delete(id: string): Promise<void> {
    await this.prisma.companyItem.delete({ where: { id } });
  }
}

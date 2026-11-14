import { Injectable } from '@nestjs/common';
import { PrismaService } from 'src/prisma/prisma.service';
import {
  CompanySupplierGroupRepository,
  CompanySupplierGroupWithSuppliers,
} from '../company-supplier-group-repository';
import { CompanySupplierGroup } from 'src/generated/prisma/client/client';

// Fornecedores dentro do grupo: só o essencial e por nome
const suppliersInclude = {
  suppliers: {
    select: { id: true, name: true, isActive: true },
    orderBy: { name: 'asc' },
  },
} as const;

@Injectable()
export class PrismaCompanySupplierGroupRepository implements CompanySupplierGroupRepository {
  constructor(private readonly prisma: PrismaService) {}

  async create(data: {
    companyId: string;
    name: string;
    description?: string;
  }): Promise<CompanySupplierGroup> {
    return this.prisma.companySupplierGroup.create({ data });
  }

  async update(
    id: string,
    data: {
      name?: string;
      description?: string;
    },
  ): Promise<CompanySupplierGroup> {
    return this.prisma.companySupplierGroup.update({ where: { id }, data });
  }

  // Apagar um grupo não pode rebentar por ter fornecedores:
  // primeiro solta-se os fornecedores, só depois se apaga o grupo
  async delete(id: string): Promise<CompanySupplierGroup> {
    const [, group] = await this.prisma.$transaction([
      this.prisma.companySupplier.updateMany({
        where: { groupId: id },
        data: { groupId: null },
      }),
      this.prisma.companySupplierGroup.delete({ where: { id } }),
    ]);

    return group;
  }

  async findById(id: string): Promise<CompanySupplierGroup | null> {
    return this.prisma.companySupplierGroup.findUnique({ where: { id } });
  }

  async findByIdWithSuppliers(id: string): Promise<CompanySupplierGroupWithSuppliers | null> {
    return this.prisma.companySupplierGroup.findUnique({
      where: { id },
      include: suppliersInclude,
    });
  }

  async findByCompanyIdAndName(
    companyId: string,
    name: string,
  ): Promise<CompanySupplierGroup | null> {
    return this.prisma.companySupplierGroup.findUnique({
      where: { companyId_name: { companyId, name } },
    });
  }

  /**
   * Uma página da lista, mais o total que existe.
   *
   * As duas coisas na mesma transação: com dois pedidos soltos, uma linha
   * criada a meio deixava o total a não bater com o que se mostra.
   */
  async findPageByCompanyId(companyId: string, pagination: { skip: number; take: number }) {
    const [items, total] = await this.prisma.$transaction([
      this.prisma.companySupplierGroup.findMany({
        where: { companyId },
        orderBy: { name: 'asc' },
        skip: pagination.skip,
        take: pagination.take,
        include: suppliersInclude,
      }),
      this.prisma.companySupplierGroup.count({ where: { companyId } }),
    ]);

    return { items, total };
  }

  async findAllByCompanyId(companyId: string): Promise<CompanySupplierGroupWithSuppliers[]> {
    return this.prisma.companySupplierGroup.findMany({
      where: { companyId },
      orderBy: { name: 'asc' },
      include: suppliersInclude,
    });
  }

  // Define o conjunto exato: limpa os atuais e atribui os novos, tudo na mesma transação
  async setSuppliers(
    id: string,
    supplierIds: string[],
  ): Promise<CompanySupplierGroupWithSuppliers | null> {
    const [, , group] = await this.prisma.$transaction([
      this.prisma.companySupplier.updateMany({
        where: { groupId: id },
        data: { groupId: null },
      }),
      this.prisma.companySupplier.updateMany({
        where: { id: { in: supplierIds } },
        data: { groupId: id },
      }),
      this.prisma.companySupplierGroup.findUnique({
        where: { id },
        include: suppliersInclude,
      }),
    ]);

    return group;
  }

  async findSuppliersByIds(ids: string[]): Promise<{ id: string; companyId: string }[]> {
    return this.prisma.companySupplier.findMany({
      where: { id: { in: ids } },
      select: { id: true, companyId: true },
    });
  }
}

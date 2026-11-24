import { NotFoundException } from '@nestjs/common';
import { DataTableRecord, PrismaCompanyDataRepository } from '../repositories/prisma/prisma-company-data-repository';
import { DataViewRecord } from '../repositories/prisma/prisma-company-data-repository';

/** A tabela, se for desta empresa (de outra responde como se não existisse). */
export async function assertTableOfCompany(
  repository: PrismaCompanyDataRepository,
  companyId: string,
  tableId: string,
): Promise<DataTableRecord> {
  const table = await repository.findTable(tableId);
  if (!table || table.companyId !== companyId) throw new NotFoundException('Tabela não encontrada');
  return table;
}

export async function assertViewOfCompany(
  repository: PrismaCompanyDataRepository,
  companyId: string,
  viewId: string,
): Promise<DataViewRecord> {
  const view = await repository.findView(viewId);
  if (!view || view.companyId !== companyId) throw new NotFoundException('Tabela unida não encontrada');
  return view;
}

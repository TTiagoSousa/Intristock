import { BadRequestException } from '@nestjs/common';
import { Prisma } from 'src/generated/prisma/client/client';
import { PrismaCompanyDataRepository } from '../repositories/prisma/prisma-company-data-repository';
import { assertColumns } from './assertColumns';
import { tableView } from './tableView';

export const DATA_TABLE_SOURCES = ['file', 'manual'] as const;

export async function createDataTable(
  repository: PrismaCompanyDataRepository,
  companyId: string,
  userId: string,
  input: { name: string; source: (typeof DATA_TABLE_SOURCES)[number]; columns: unknown; keyColumn?: string | null },
) {
  const name = input.name.trim();
  if (!name) throw new BadRequestException('A tabela precisa de um nome');
  const columns = assertColumns(input.columns);
  const keyColumn = input.keyColumn || null;
  if (keyColumn && !columns.some((c) => c.key === keyColumn)) throw new BadRequestException('A coluna chave não está nas colunas');

  const table = await repository.createTable({
    companyId,
    name,
    source: input.source,
    columns: columns as unknown as Prisma.InputJsonValue,
    keyColumn,
    createdById: userId,
  });
  return tableView(table);
}

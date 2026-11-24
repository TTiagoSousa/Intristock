import { BadRequestException } from '@nestjs/common';
import { Prisma } from 'src/generated/prisma/client/client';
import { DataTableRecord, PrismaCompanyDataRepository } from '../repositories/prisma/prisma-company-data-repository';
import { assertColumns } from './assertColumns';
import { DataColumn, JoinPair, ViewColumn } from './dataTypes';
import { tableView } from './tableView';

/**
 * O nome, as colunas (a lista toda; as de antes pela `key`) e a coluna chave.
 * A chave só muda com a tabela vazia (as linhas estão guardadas pela de antes)
 * e não se tira uma coluna que uma tabela unida usa.
 */
export async function updateDataTable(
  repository: PrismaCompanyDataRepository,
  table: DataTableRecord,
  input: { name?: string; columns?: unknown; keyColumn?: string | null },
) {
  const data: Prisma.CompanyDataTableUncheckedUpdateInput = {};
  const current = table.columns as unknown as DataColumn[];
  let columns = current;

  if (input.name !== undefined) {
    const name = input.name.trim();
    if (!name) throw new BadRequestException('A tabela precisa de um nome');
    data.name = name;
  }

  if (input.columns !== undefined) {
    columns = assertColumns(input.columns, current);
    const kept = new Set(columns.map((c) => c.key));
    const removed = current.filter((c) => !kept.has(c.key));
    if (removed.length) {
      const views = await repository.findViewsUsingTable(table.id);
      for (const view of views) {
        const side = view.leftTableId === table.id ? 'left' : 'right';
        const used = new Set<string>([
          ...(view.joinOn as unknown as JoinPair[]).map((p) => p[side]),
          ...(view.columns as unknown as ViewColumn[]).filter((c) => c.side === side).map((c) => c.column),
        ]);
        const blocked = removed.find((c) => used.has(c.key));
        if (blocked) {
          throw new BadRequestException(`A coluna «${blocked.label}» é usada na tabela unida «${view.name}»`);
        }
      }
    }
    data.columns = columns as unknown as Prisma.InputJsonValue;
  }

  const keyColumn = input.keyColumn === undefined ? table.keyColumn : input.keyColumn || null;
  if (keyColumn !== table.keyColumn) {
    if (table._count.rows > 0) {
      throw new BadRequestException('A coluna chave só se muda com a tabela vazia — apaga as linhas ou cria outra tabela');
    }
    data.keyColumn = keyColumn;
  }
  if (keyColumn && !columns.some((c) => c.key === keyColumn)) {
    throw new BadRequestException('A coluna chave não pode sair da tabela');
  }

  return tableView(await repository.updateTable(table.id, data));
}

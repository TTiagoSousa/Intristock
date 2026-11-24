import { ConflictException } from '@nestjs/common';
import { DataTableRecord, PrismaCompanyDataRepository } from '../repositories/prisma/prisma-company-data-repository';

/** Apaga a tabela com as linhas e as importações; uma usada numa tabela unida ou numa secção das Leads não se apaga. */
export async function deleteDataTable(repository: PrismaCompanyDataRepository, table: DataTableRecord) {
  const views = await repository.findViewsUsingTable(table.id);
  if (views.length) {
    throw new ConflictException(
      `A tabela é usada em ${views.map((v) => `«${v.name}»`).join(', ')} — apaga primeiro a tabela unida`,
    );
  }
  const boards = await repository.findLeadBoardsUsing({ tableId: table.id });
  if (boards.length) {
    throw new ConflictException(`A tabela é usada nas Leads em ${boards.map((b) => `«${b.name}»`).join(', ')} — muda ou apaga primeiro a secção`);
  }
  const connections = await repository.findConnectionsUsingTable(table.id);
  if (connections.length) {
    throw new ConflictException(`A tabela recebe a ligação à ${connections.map((c) => c.baseUrl).join(', ')} — apaga primeiro a ligação`);
  }
  await repository.deleteTable(table.id);
  return { ok: true };
}

import { randomUUID } from 'crypto';
import { Injectable } from '@nestjs/common';
import { PrismaService } from 'src/prisma/prisma.service';
import { Prisma } from 'src/generated/prisma/client/client';
import { ColumnValueCount, ColumnValuesQuery, ImportRow, RowsQuery, StoredRow, UpsertCounts } from '../company-data-repository';
import { RowData } from '../../helpers/dataTypes';
import { RowFilter } from '../../helpers/rowFilters';

type Tx = Prisma.TransactionClient;

const escapeLike = (term: string) => `%${term.replace(/[\\%_]/g, (c) => `\\${c}`)}%`;
const SQL_COMPARE = { equals: '=', gt: '>', gte: '>=', lt: '<', lte: '<=' } as const;

/** Um filtro por coluna em SQL: a mesma regra do `matchesRowFilter` (as tabelas unidas filtram em memória). */
function rowFilterSql(filter: RowFilter): Prisma.Sql {
  const text = Prisma.sql`("data" ->> ${filter.column})`;
  const empty = Prisma.sql`(${text} IS NULL OR btrim(${text}) = '')`;
  if (filter.op === 'empty') return empty;
  if (filter.op === 'notEmpty') return Prisma.sql`NOT ${empty}`;
  if (filter.op === 'in') {
    const values = Prisma.join(filter.values!.map((v) => Prisma.sql`${v}`));
    return Prisma.sql`(lower(btrim(coalesce(${text}, ''))) IN (${values}))`;
  }
  if (filter.op === 'contains') return Prisma.sql`(${text} ILIKE ${escapeLike(filter.value!)})`;

  const op = Prisma.raw(SQL_COMPARE[filter.op === 'not' ? 'equals' : filter.op]);
  let hit: Prisma.Sql;
  if (filter.kind === 'number') {
    const number = Prisma.sql`(CASE WHEN jsonb_typeof("data" -> ${filter.column}) = 'number' THEN (${text})::numeric END)`;
    hit = Prisma.sql`${number} ${op} ${String(filter.number)}::numeric`;
  } else if (filter.kind === 'date') {
    hit = Prisma.sql`(NOT ${empty} AND left(${text}, 10) ${op} ${filter.value})`;
  } else {
    hit = Prisma.sql`(NOT ${empty} AND lower(btrim(${text})) = lower(${filter.value}))`;
  }
  return filter.op === 'not' ? Prisma.sql`NOT coalesce(${hit}, false)` : Prisma.sql`coalesce(${hit}, false)`;
}

// Uma tabela para o ecrã: as linhas contam-se e a última importação vê-se
const TABLE_VIEW = {
  id: true,
  companyId: true,
  name: true,
  source: true,
  columns: true,
  keyColumn: true,
  importConfig: true,
  createdAt: true,
  updatedAt: true,
  _count: { select: { rows: true } },
  imports: { select: { createdAt: true }, orderBy: { createdAt: 'desc' }, take: 1 },
} satisfies Prisma.CompanyDataTableSelect;

const VIEW_VIEW = {
  id: true,
  companyId: true,
  name: true,
  leftTableId: true,
  rightTableId: true,
  joinOn: true,
  joinType: true,
  columns: true,
  createdAt: true,
  updatedAt: true,
  leftTable: { select: { id: true, name: true } },
  rightTable: { select: { id: true, name: true } },
} satisfies Prisma.CompanyDataViewSelect;

const IMPORT_VIEW = {
  id: true,
  fileName: true,
  status: true,
  created: true,
  updated: true,
  unchanged: true,
  skipped: true,
  errors: true,
  createdAt: true,
} satisfies Prisma.CompanyDataImportSelect;

// Linhas por INSERT (7 parâmetros cada, longe do limite do Postgres)
const BATCH = 500;

@Injectable()
export class PrismaCompanyDataRepository {
  constructor(private readonly prisma: PrismaService) {}

  transaction<T>(fn: (tx: Tx) => Promise<T>) {
    return this.prisma.$transaction(fn, { timeout: 120_000, maxWait: 10_000 });
  }

  // ── tabelas ──

  findTables(companyId: string) {
    return this.prisma.companyDataTable.findMany({ where: { companyId }, orderBy: { name: 'asc' }, select: TABLE_VIEW });
  }

  findTable(id: string) {
    return this.prisma.companyDataTable.findUnique({ where: { id }, select: TABLE_VIEW });
  }

  createTable(data: Prisma.CompanyDataTableUncheckedCreateInput) {
    return this.prisma.companyDataTable.create({ data, select: TABLE_VIEW });
  }

  updateTable(id: string, data: Prisma.CompanyDataTableUncheckedUpdateInput, tx?: Tx) {
    return (tx ?? this.prisma).companyDataTable.update({ where: { id }, data, select: TABLE_VIEW });
  }

  async deleteTable(id: string) {
    await this.prisma.companyDataTable.delete({ where: { id } });
  }

  /** As linhas mudaram: a tabela fica com outra versão (a cache das unidas vê-a). */
  async touchTable(id: string, tx?: Tx) {
    await (tx ?? this.prisma).companyDataTable.update({ where: { id }, data: { updatedAt: new Date() } });
  }

  countRows(tableId: string, tx?: Tx) {
    return (tx ?? this.prisma).companyDataRow.count({ where: { tableId } });
  }

  // ── linhas ──

  async findRows(tableId: string, query: RowsQuery): Promise<{ rows: StoredRow[]; total: number }> {
    const term = query.search?.trim();
    const searching = Boolean(term && query.searchKeys.length);
    if (!searching && !query.filters.length) {
      const [rows, total] = await Promise.all([
        this.prisma.companyDataRow.findMany({
          where: { tableId },
          orderBy: [{ createdAt: 'asc' }, { id: 'asc' }],
          skip: query.skip,
          take: query.take,
          select: { id: true, key: true, data: true, updatedAt: true },
        }),
        this.prisma.companyDataRow.count({ where: { tableId } }),
      ]);
      return { rows: rows as StoredRow[], total };
    }

    const where = Prisma.join(this.rowConditions(tableId, query), ' AND ');
    const [rows, count] = await Promise.all([
      this.prisma.$queryRaw<StoredRow[]>`
        SELECT "id", "key", "data", "updatedAt" FROM "CompanyDataRow"
        WHERE ${where}
        ORDER BY "createdAt" ASC, "id" ASC
        OFFSET ${query.skip} LIMIT ${query.take}`,
      this.prisma.$queryRaw<{ n: bigint }[]>`SELECT COUNT(*) AS n FROM "CompanyDataRow" WHERE ${where}`,
    ]);
    return { rows, total: Number(count[0]?.n ?? 0) };
  }

  // A pesquisa só nas colunas que quem pede pode ver; os filtros juntam-se com E
  private rowConditions(tableId: string, query: Pick<RowsQuery, 'search' | 'searchKeys' | 'filters'>) {
    const term = query.search?.trim();
    const conditions = [Prisma.sql`"tableId" = ${tableId}`];
    if (term && query.searchKeys.length) {
      const like = escapeLike(term);
      conditions.push(Prisma.sql`(${Prisma.join(query.searchKeys.map((key) => Prisma.sql`("data" ->> ${key}) ILIKE ${like}`), ' OR ')})`);
    }
    conditions.push(...query.filters.map(rowFilterSql));
    return conditions;
  }

  /**
   * Os valores de uma coluna com quantas linhas os têm, dos mais frequentes: juntos sem
   * maiúsculas nem espaços à volta (como o «é» e o «é um de»), as vazias em "".
   */
  async findColumnValues(tableId: string, query: ColumnValuesQuery): Promise<ColumnValueCount[]> {
    const cell = Prisma.sql`btrim(coalesce("data" ->> ${query.column}, ''))`;
    const conditions = this.rowConditions(tableId, query);
    const q = query.q?.trim();
    if (q) conditions.push(Prisma.sql`${cell} ILIKE ${escapeLike(q)}`);
    const rows = await this.prisma.$queryRaw<{ value: string; count: bigint }[]>`
      SELECT min(${cell}) AS value, COUNT(*) AS count FROM "CompanyDataRow"
      WHERE ${Prisma.join(conditions, ' AND ')}
      GROUP BY lower(${cell})
      ORDER BY count DESC, value ASC
      LIMIT ${query.limit}`;
    return rows.map((r) => ({ value: r.value, count: Number(r.count) }));
  }

  /** Todas as linhas com o que as identifica (a chave ou, sem ela, o id), para as tabelas unidas e as leads. */
  async findAllRows(tableId: string): Promise<{ ref: string; data: RowData }[]> {
    const rows = await this.prisma.companyDataRow.findMany({
      where: { tableId },
      orderBy: [{ createdAt: 'asc' }, { id: 'asc' }],
      select: { id: true, key: true, data: true },
    });
    return rows.map((r) => ({ ref: r.key ?? r.id, data: r.data as RowData }));
  }

  /** As linhas pelas chaves ou ids (as leads que já não passam o filtro). */
  async findRowsByRefs(tableId: string, refs: string[]): Promise<{ ref: string; data: RowData }[]> {
    if (!refs.length) return [];
    const uuids = refs.filter((r) => /^[0-9a-f-]{36}$/i.test(r));
    const rows = await this.prisma.companyDataRow.findMany({
      where: { tableId, OR: [{ key: { in: refs } }, ...(uuids.length ? [{ id: { in: uuids } }] : [])] },
      select: { id: true, key: true, data: true },
    });
    return rows.map((r) => ({ ref: r.key ?? r.id, data: r.data as RowData }));
  }

  /** As secções das Leads que leem esta tabela ou tabela unida (não se apaga enquanto houver). */
  // ── ligações às APIs (Shopify) ──

  findConnections(companyId: string) {
    return this.prisma.companyDataConnection.findMany({ where: { companyId }, orderBy: { createdAt: 'asc' }, include: { table: { select: { name: true } } } });
  }

  findConnection(id: string) {
    return this.prisma.companyDataConnection.findUnique({ where: { id } });
  }

  /** As ligações ativas de todas as empresas (a tarefa em fundo vê quais já passaram o intervalo). */
  findActiveConnections() {
    return this.prisma.companyDataConnection.findMany({ where: { status: { in: ['active', 'error'] } } });
  }

  findConnectionsUsingTable(tableId: string) {
    return this.prisma.companyDataConnection.findMany({ where: { tableId }, select: { id: true, baseUrl: true } });
  }

  createConnection(tx: Tx, data: Prisma.CompanyDataConnectionUncheckedCreateInput) {
    return tx.companyDataConnection.create({ data });
  }

  updateConnection(id: string, data: Prisma.CompanyDataConnectionUncheckedUpdateInput, tx?: Tx) {
    return (tx ?? this.prisma).companyDataConnection.update({ where: { id }, data });
  }

  async deleteConnection(id: string) {
    await this.prisma.companyDataConnection.delete({ where: { id } });
  }

  findLeadBoardsUsing(source: { tableId?: string; viewId?: string }) {
    return this.prisma.companyLeadBoard.findMany({ where: source, select: { id: true, name: true } });
  }

  findRow(id: string) {
    return this.prisma.companyDataRow.findUnique({ where: { id }, select: { id: true, tableId: true, key: true, data: true, updatedAt: true } });
  }

  findRowByKey(tableId: string, key: string) {
    return this.prisma.companyDataRow.findUnique({ where: { tableId_key: { tableId, key } }, select: { id: true } });
  }

  createRow(tableId: string, key: string | null, data: RowData) {
    return this.prisma.companyDataRow.create({
      data: { tableId, key, data: data as Prisma.InputJsonValue },
      select: { id: true, key: true, data: true, updatedAt: true },
    });
  }

  updateRow(id: string, key: string | null, data: RowData) {
    return this.prisma.companyDataRow.update({
      where: { id },
      data: { key, data: data as Prisma.InputJsonValue },
      select: { id: true, key: true, data: true, updatedAt: true },
    });
  }

  async deleteRow(id: string) {
    await this.prisma.companyDataRow.delete({ where: { id } });
  }

  /**
   * Grava as linhas de uma importação pela chave: as novas entram, as que já
   * existem juntam os valores do ficheiro aos delas (as colunas que o ficheiro
   * não traz ficam) e as que vêm iguais não se tocam.
   */
  async upsertRows(tx: Tx, tableId: string, importId: string, rows: ImportRow[]): Promise<UpsertCounts> {
    const counts: UpsertCounts = { created: 0, updated: 0, unchanged: 0 };
    for (let i = 0; i < rows.length; i += BATCH) {
      const batch = rows.slice(i, i + BATCH);
      const values = batch.map(
        (r) => Prisma.sql`(${randomUUID()}, ${tableId}, ${r.key}, ${JSON.stringify(r.data)}::jsonb, ${importId}, now(), now())`,
      );
      const result = await tx.$queryRaw<{ inserted: boolean }[]>`
        INSERT INTO "CompanyDataRow" ("id", "tableId", "key", "data", "importId", "createdAt", "updatedAt")
        VALUES ${Prisma.join(values)}
        ON CONFLICT ("tableId", "key") DO UPDATE
          SET "data" = "CompanyDataRow"."data" || EXCLUDED."data", "importId" = EXCLUDED."importId", "updatedAt" = now()
          WHERE ("CompanyDataRow"."data" || EXCLUDED."data") IS DISTINCT FROM "CompanyDataRow"."data"
        RETURNING (xmax = 0) AS inserted`;
      const created = result.filter((r) => r.inserted).length;
      counts.created += created;
      counts.updated += result.length - created;
      counts.unchanged += batch.length - result.length;
    }
    return counts;
  }

  /** Numa tabela sem chave cada importação acrescenta. */
  async insertRows(tx: Tx, tableId: string, importId: string, rows: ImportRow[]) {
    for (let i = 0; i < rows.length; i += BATCH) {
      await tx.companyDataRow.createMany({
        data: rows.slice(i, i + BATCH).map((r) => ({ tableId, importId, key: null, data: r.data as Prisma.InputJsonValue })),
      });
    }
    return rows.length;
  }

  // ── importações ──

  createImport(tx: Tx, data: Prisma.CompanyDataImportUncheckedCreateInput) {
    return tx.companyDataImport.create({ data, select: IMPORT_VIEW });
  }

  updateImport(id: string, data: Prisma.CompanyDataImportUncheckedUpdateInput, tx?: Tx) {
    return (tx ?? this.prisma).companyDataImport.update({ where: { id }, data, select: IMPORT_VIEW });
  }

  recordFailedImport(data: Prisma.CompanyDataImportUncheckedCreateInput) {
    return this.prisma.companyDataImport.create({ data, select: IMPORT_VIEW });
  }

  findImports(tableId: string) {
    return this.prisma.companyDataImport.findMany({ where: { tableId }, orderBy: { createdAt: 'desc' }, take: 100, select: IMPORT_VIEW });
  }

  // ── tabelas unidas ──

  findViews(companyId: string) {
    return this.prisma.companyDataView.findMany({ where: { companyId }, orderBy: { name: 'asc' }, select: VIEW_VIEW });
  }

  findView(id: string) {
    return this.prisma.companyDataView.findUnique({ where: { id }, select: VIEW_VIEW });
  }

  findViewsUsingTable(tableId: string) {
    return this.prisma.companyDataView.findMany({
      where: { OR: [{ leftTableId: tableId }, { rightTableId: tableId }] },
      select: VIEW_VIEW,
    });
  }

  createView(data: Prisma.CompanyDataViewUncheckedCreateInput) {
    return this.prisma.companyDataView.create({ data, select: VIEW_VIEW });
  }

  updateView(id: string, data: Prisma.CompanyDataViewUncheckedUpdateInput) {
    return this.prisma.companyDataView.update({ where: { id }, data, select: VIEW_VIEW });
  }

  async deleteView(id: string) {
    await this.prisma.companyDataView.delete({ where: { id } });
  }
}

export type DataTableRecord = NonNullable<Awaited<ReturnType<PrismaCompanyDataRepository['findTable']>>>;
export type DataConnectionRecord = NonNullable<Awaited<ReturnType<PrismaCompanyDataRepository['findConnection']>>>;
export type DataViewRecord = NonNullable<Awaited<ReturnType<PrismaCompanyDataRepository['findView']>>>;

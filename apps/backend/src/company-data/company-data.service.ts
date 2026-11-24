import { BadRequestException, ConflictException, Injectable } from '@nestjs/common';
import { Prisma } from 'src/generated/prisma/client/client';
import { PrismaCompanyRepository } from 'src/company/repositories/prisma/prisma-company-repository';
import { DataViewRecord, PrismaCompanyDataRepository } from './repositories/prisma/prisma-company-data-repository';
import {
  CreateDataTableDto,
  CreateDataViewDto,
  DataColumnValuesQueryDto,
  DataRowsQueryDto,
  DataViewDefinitionDto,
  DataViewColumnValuesQueryDto,
  DataViewRowsQueryDto,
  ImportDataFileDto,
  SaveDataRowDto,
  UpdateDataTableDto,
  UpdateDataViewDto,
} from './dto/company-data.dto';
import { assertDataAccess } from './helpers/assertDataAccess';
import { assertTableOfCompany, assertViewOfCompany } from './helpers/assertTableOfCompany';
import { previewSpreadsheet } from './helpers/previewSpreadsheet';
import { tableView } from './helpers/tableView';
import { createDataTable } from './helpers/createDataTable';
import { updateDataTable } from './helpers/updateDataTable';
import { deleteDataTable } from './helpers/deleteDataTable';
import { importDataFile } from './helpers/importDataFile';
import { findDataRows } from './helpers/findDataRows';
import { findColumnValues } from './helpers/findColumnValues';
import { joinedColumnValues } from './helpers/joinedColumnValues';
import { saveDataRow } from './helpers/saveDataRow';
import { assertViewDefinition, ViewDefinition } from './helpers/assertViewDefinition';
import { computeViewJoin } from './helpers/computeViewJoin';
import { filterJoinedRows, pageJoinedRows, ViewFilter } from './helpers/pageJoinedRows';
import { joinedColumns, JoinResult } from './helpers/joinTables';
import { DataColumn, DataColumnType, JoinPair, JoinType, RowData, ViewColumn } from './helpers/dataTypes';
import { maskRow } from './helpers/maskRow';
import { parseRowFilters } from './helpers/rowFilters';

export type UploadedDataFile = { buffer: Buffer; size: number; originalname: string };

/** De onde vêm as linhas de uma secção das Leads: uma tabela ou uma tabela unida. */
export type DataSource = { type: 'table' | 'view'; id: string };

/** Uma coluna da origem (numa unida, `c0`, `c1`…). */
export type SourceColumn = { key: string; label: string; type: DataColumnType; personal: boolean; side?: 'left' | 'right' };

/** Uma linha da origem: o que a identifica (`ref`) e os valores, com as pessoais em ••• para quem não as vê. */
export type SourceRow = { ref: string; values: RowData };

// As tabelas unidas calculam-se ao ler; a junção fica em memória enquanto nem
// ela nem as duas tabelas mudarem (a versão é o updatedAt de cada uma)
const CACHE_MS = 5 * 60_000;
const CACHE_MAX = 20;

@Injectable()
export class CompanyDataService {
  private readonly joins = new Map<string, { version: string; at: number; result: JoinResult }>();

  constructor(
    private readonly repository: PrismaCompanyDataRepository,
    private readonly companyRepository: PrismaCompanyRepository,
  ) {}

  private access(userId: string, companyId: string, permission: 'data.view' | 'data.manage') {
    return assertDataAccess(userId, companyId, this.companyRepository, permission);
  }

  // ── tabelas ──

  async preview(userId: string, companyId: string, file: UploadedDataFile) {
    await this.access(userId, companyId, 'data.manage');
    return previewSpreadsheet(file);
  }

  async tables(userId: string, companyId: string) {
    await this.access(userId, companyId, 'data.view');
    return (await this.repository.findTables(companyId)).map(tableView);
  }

  async table(userId: string, companyId: string, tableId: string) {
    await this.access(userId, companyId, 'data.view');
    return tableView(await assertTableOfCompany(this.repository, companyId, tableId));
  }

  async createTable(userId: string, companyId: string, dto: CreateDataTableDto) {
    await this.access(userId, companyId, 'data.manage');
    return createDataTable(this.repository, companyId, userId, dto);
  }

  async updateTable(userId: string, companyId: string, tableId: string, dto: UpdateDataTableDto) {
    await this.access(userId, companyId, 'data.manage');
    const table = await assertTableOfCompany(this.repository, companyId, tableId);
    return updateDataTable(this.repository, table, dto);
  }

  async deleteTable(userId: string, companyId: string, tableId: string) {
    await this.access(userId, companyId, 'data.manage');
    const table = await assertTableOfCompany(this.repository, companyId, tableId);
    return deleteDataTable(this.repository, table);
  }

  async importFile(userId: string, companyId: string, tableId: string, file: UploadedDataFile, dto: ImportDataFileDto) {
    await this.access(userId, companyId, 'data.manage');
    const table = await assertTableOfCompany(this.repository, companyId, tableId);
    let mapping: unknown;
    try {
      mapping = JSON.parse(dto.mapping);
    } catch {
      throw new BadRequestException('A ligação das colunas não é válida');
    }
    if (!mapping || typeof mapping !== 'object' || Array.isArray(mapping)) {
      throw new BadRequestException('A ligação das colunas não é válida');
    }
    const clean = Object.fromEntries(
      Object.entries(mapping as Record<string, unknown>).filter(([, v]) => typeof v === 'string' && v),
    ) as Record<string, string>;
    return importDataFile(this.repository, table, userId, file, { mapping: clean, skipTotals: dto.skipTotals === 'true' });
  }

  async imports(userId: string, companyId: string, tableId: string) {
    await this.access(userId, companyId, 'data.view');
    await assertTableOfCompany(this.repository, companyId, tableId);
    return this.repository.findImports(tableId);
  }

  // ── linhas ──

  async rows(userId: string, companyId: string, tableId: string, query: DataRowsQueryDto) {
    const { canSeePersonal } = await this.access(userId, companyId, 'data.view');
    const table = await assertTableOfCompany(this.repository, companyId, tableId);
    return findDataRows(this.repository, table, canSeePersonal, query);
  }

  async columnValues(userId: string, companyId: string, tableId: string, query: DataColumnValuesQueryDto) {
    const { canSeePersonal } = await this.access(userId, companyId, 'data.view');
    const table = await assertTableOfCompany(this.repository, companyId, tableId);
    return findColumnValues(this.repository, table, canSeePersonal, query);
  }

  async createRow(userId: string, companyId: string, tableId: string, dto: SaveDataRowDto) {
    const { canSeePersonal } = await this.access(userId, companyId, 'data.manage');
    const table = await assertTableOfCompany(this.repository, companyId, tableId);
    return saveDataRow(this.repository, table, canSeePersonal, dto);
  }

  async updateRow(userId: string, companyId: string, tableId: string, rowId: string, dto: SaveDataRowDto) {
    const { canSeePersonal } = await this.access(userId, companyId, 'data.manage');
    const table = await assertTableOfCompany(this.repository, companyId, tableId);
    return saveDataRow(this.repository, table, canSeePersonal, dto, rowId);
  }

  async deleteRow(userId: string, companyId: string, tableId: string, rowId: string) {
    await this.access(userId, companyId, 'data.manage');
    const table = await assertTableOfCompany(this.repository, companyId, tableId);
    const row = await this.repository.findRow(rowId);
    if (!row || row.tableId !== table.id) throw new BadRequestException('Linha não encontrada');
    await this.repository.deleteRow(rowId);
    await this.repository.touchTable(table.id);
    return { ok: true };
  }

  // ── tabelas unidas ──

  async views(userId: string, companyId: string) {
    await this.access(userId, companyId, 'data.view');
    return this.repository.findViews(companyId);
  }

  async view(userId: string, companyId: string, viewId: string) {
    await this.access(userId, companyId, 'data.view');
    return assertViewOfCompany(this.repository, companyId, viewId);
  }

  private async definitionOf(companyId: string, dto: DataViewDefinitionDto) {
    const [left, right] = await Promise.all([
      assertTableOfCompany(this.repository, companyId, dto.leftTableId),
      assertTableOfCompany(this.repository, companyId, dto.rightTableId),
    ]);
    const definition = assertViewDefinition(
      dto,
      left.columns as unknown as DataColumn[],
      right.columns as unknown as DataColumn[],
    );
    return { left, right, definition };
  }

  private viewData(definition: ViewDefinition) {
    return {
      joinOn: definition.joinOn as unknown as Prisma.InputJsonValue,
      joinType: definition.joinType,
      columns: definition.columns as unknown as Prisma.InputJsonValue,
    };
  }

  async previewView(userId: string, companyId: string, dto: DataViewDefinitionDto) {
    const { canSeePersonal } = await this.access(userId, companyId, 'data.manage');
    const { left, right, definition } = await this.definitionOf(companyId, dto);
    const result = await computeViewJoin(this.repository, left, right, definition);
    const page = pageJoinedRows(result, canSeePersonal, { page: 1, take: 50 });
    return { columns: page.columns, rows: page.rows, stats: page.stats };
  }

  async createView(userId: string, companyId: string, dto: CreateDataViewDto) {
    await this.access(userId, companyId, 'data.manage');
    const name = dto.name.trim();
    if (!name) throw new BadRequestException('A tabela unida precisa de um nome');
    const { definition } = await this.definitionOf(companyId, dto);
    return this.repository.createView({
      companyId,
      name,
      leftTableId: dto.leftTableId,
      rightTableId: dto.rightTableId,
      ...this.viewData(definition),
      createdById: userId,
    });
  }

  async updateView(userId: string, companyId: string, viewId: string, dto: UpdateDataViewDto) {
    await this.access(userId, companyId, 'data.manage');
    const view = await assertViewOfCompany(this.repository, companyId, viewId);
    const merged: DataViewDefinitionDto = {
      leftTableId: dto.leftTableId ?? view.leftTableId,
      rightTableId: dto.rightTableId ?? view.rightTableId,
      joinOn: dto.joinOn ?? (view.joinOn as unknown as JoinPair[]),
      joinType: dto.joinType ?? (view.joinType as JoinType),
      columns: dto.columns ?? (view.columns as unknown as ViewColumn[]),
    };
    const { definition } = await this.definitionOf(companyId, merged);
    const name = dto.name?.trim();
    if (dto.name !== undefined && !name) throw new BadRequestException('A tabela unida precisa de um nome');
    this.joins.delete(viewId);
    return this.repository.updateView(viewId, {
      ...(name ? { name } : {}),
      leftTableId: merged.leftTableId,
      rightTableId: merged.rightTableId,
      ...this.viewData(definition),
    });
  }

  async deleteView(userId: string, companyId: string, viewId: string) {
    await this.access(userId, companyId, 'data.manage');
    await assertViewOfCompany(this.repository, companyId, viewId);
    const boards = await this.repository.findLeadBoardsUsing({ viewId });
    if (boards.length) {
      throw new ConflictException(`A tabela unida é usada nas Leads em ${boards.map((b) => `«${b.name}»`).join(', ')} — muda ou apaga primeiro a secção`);
    }
    this.joins.delete(viewId);
    await this.repository.deleteView(viewId);
    return { ok: true };
  }

  async viewRows(userId: string, companyId: string, viewId: string, query: DataViewRowsQueryDto) {
    const { canSeePersonal } = await this.access(userId, companyId, 'data.view');
    const view = await assertViewOfCompany(this.repository, companyId, viewId);
    const result = await this.joinOf(companyId, view);
    return pageJoinedRows(result, canSeePersonal, query);
  }

  async viewColumnValues(userId: string, companyId: string, viewId: string, query: DataViewColumnValuesQueryDto) {
    const { canSeePersonal } = await this.access(userId, companyId, 'data.view');
    const view = await assertViewOfCompany(this.repository, companyId, viewId);
    const result = await this.joinOf(companyId, view);
    return joinedColumnValues(result, canSeePersonal, query);
  }

  // ── para as Leads (o acesso vê-se lá, com as permissões delas) ──

  /** O nome e as colunas de uma origem (a tabela ou a tabela unida da empresa). */
  async sourceInfo(companyId: string, source: DataSource): Promise<{ name: string; columns: SourceColumn[] }> {
    if (source.type === 'table') {
      const table = await assertTableOfCompany(this.repository, companyId, source.id);
      const columns = (table.columns as unknown as DataColumn[]).map(({ key, label, type, personal }) => ({ key, label, type, personal }));
      return { name: table.name, columns };
    }
    const view = await assertViewOfCompany(this.repository, companyId, source.id);
    const [left, right] = await Promise.all([
      assertTableOfCompany(this.repository, companyId, view.leftTableId),
      assertTableOfCompany(this.repository, companyId, view.rightTableId),
    ]);
    const columns = joinedColumns(
      view.columns as unknown as ViewColumn[],
      left.columns as unknown as DataColumn[],
      right.columns as unknown as DataColumn[],
    ).map(({ key, label, type, personal, side }) => ({ key, label, type, personal, side }));
    return { name: view.name, columns };
  }

  /**
   * As linhas de uma origem que passam a pesquisa e os filtros (até `limit`, com o total) e, à parte, as
   * pedidas pelo `ref` (`extraRefs`: as leads que já estão no quadro, passem ou não). Os filtros são os da secção:
   * valem também nas colunas pessoais, mas os valores delas saem em ••• a quem não as vê.
   */
  async readSource(
    companyId: string,
    source: DataSource,
    canSeePersonal: boolean,
    query: { filters?: string; search?: string; only?: ViewFilter; limit: number; extraRefs?: string[] },
  ): Promise<{ columns: SourceColumn[]; rows: SourceRow[]; total: number; extra: SourceRow[] }> {
    const extraRefs = query.extraRefs ?? [];
    if (source.type === 'table') {
      const table = await assertTableOfCompany(this.repository, companyId, source.id);
      const columns = table.columns as unknown as DataColumn[];
      const mask = (data: RowData) => (canSeePersonal ? data : maskRow(data, columns));
      const [{ rows, total }, extra] = await Promise.all([
        this.repository.findRows(table.id, {
          skip: 0,
          take: query.limit,
          search: query.search,
          searchKeys: columns.filter((c) => canSeePersonal || !c.personal).map((c) => c.key),
          filters: parseRowFilters(query.filters, columns, true),
        }),
        this.repository.findRowsByRefs(table.id, extraRefs),
      ]);
      return {
        columns: columns.map(({ key, label, type, personal }) => ({ key, label, type, personal })),
        rows: rows.map((r) => ({ ref: r.key ?? r.id, values: mask(r.data) })),
        total,
        extra: extra.map((r) => ({ ref: r.ref, values: mask(r.data) })),
      };
    }

    const view = await assertViewOfCompany(this.repository, companyId, source.id);
    const result = await this.joinOf(companyId, view);
    const mask = (data: RowData) => (canSeePersonal ? data : maskRow(data, result.columns));
    const filtered = filterJoinedRows(result, canSeePersonal, {
      search: query.search,
      only: query.only,
      filters: query.filters,
      filtersAsOwner: true,
    });
    const wanted = new Set(extraRefs);
    return {
      columns: result.columns.map(({ key, label, type, personal, side }) => ({ key, label, type, personal, side })),
      rows: filtered.slice(0, query.limit).map((r) => ({ ref: r.ref, values: mask(r.values) })),
      total: filtered.length,
      extra: wanted.size ? result.rows.filter((r) => wanted.has(r.ref)).map((r) => ({ ref: r.ref, values: mask(r.values) })) : [],
    };
  }

  private async joinOf(companyId: string, view: DataViewRecord) {
    const [left, right] = await Promise.all([
      assertTableOfCompany(this.repository, companyId, view.leftTableId),
      assertTableOfCompany(this.repository, companyId, view.rightTableId),
    ]);
    const version = [view.updatedAt, left.updatedAt, right.updatedAt].map((d) => d.getTime()).join(':');
    const cached = this.joins.get(view.id);
    if (cached && cached.version === version && Date.now() - cached.at < CACHE_MS) return cached.result;

    const definition: ViewDefinition = {
      joinOn: view.joinOn as unknown as JoinPair[],
      joinType: view.joinType as JoinType,
      columns: view.columns as unknown as ViewColumn[],
    };
    const result = await computeViewJoin(this.repository, left, right, definition);

    this.joins.delete(view.id);
    this.joins.set(view.id, { version, at: Date.now(), result });
    // A mais antiga sai primeiro (o Map guarda a ordem de entrada)
    for (const key of this.joins.keys()) {
      if (this.joins.size <= CACHE_MAX) break;
      this.joins.delete(key);
    }
    return result;
  }
}

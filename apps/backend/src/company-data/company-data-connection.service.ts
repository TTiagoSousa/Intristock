import { BadRequestException, ConflictException, Injectable, Logger, NotFoundException, OnModuleDestroy, OnModuleInit } from '@nestjs/common';
import { Prisma } from 'src/generated/prisma/client/client';
import { isConnectionDue } from 'src/common/isConnectionDue';
import { encryptSecret } from 'src/utils/crypto/secret-box';
import { PrismaCompanyRepository } from 'src/company/repositories/prisma/prisma-company-repository';
import { DataConnectionRecord, PrismaCompanyDataRepository } from './repositories/prisma/prisma-company-data-repository';
import { assertDataAccess } from './helpers/assertDataAccess';
import { assertTableOfCompany } from './helpers/assertTableOfCompany';
import { checkShopifyShop } from './helpers/connections/shopifyClient';
import { SHOPIFY_ORDER_FIELDS } from './helpers/connections/shopifyOrders';
import { assertConnectionMapping, columnsForFields, MAX_CONNECTIONS, normalizeShop } from './helpers/connections/saveDataConnection';
import { credentialsContext, syncDataConnection } from './helpers/connections/syncDataConnection';
import { CheckDataConnectionDto, CreateDataConnectionDto, UpdateDataConnectionDto } from './dto/company-data-connection.dto';

// De quanto em quanto tempo se vê que ligações há por sincronizar; a primeira volta uns minutos depois do arranque
const CHECK_EVERY_MS = 5 * 60 * 1000;
const FIRST_CHECK_MIN_MS = 3 * 60 * 1000;
const FIRST_CHECK_JITTER_MS = 3 * 60 * 1000;

type SyncResult = Awaited<ReturnType<typeof syncDataConnection>>;

/** O que o ecrã vê de uma ligação (sem a chave). */
const connectionView = (c: DataConnectionRecord & { table?: { name: string } | null }) => ({
  id: c.id,
  provider: c.provider,
  shop: c.baseUrl,
  tableId: c.tableId,
  tableName: c.table?.name ?? null,
  mapping: c.mapping,
  status: c.status,
  syncEveryHours: c.syncEveryHours,
  cursor: c.cursor,
  lastError: c.lastError,
  syncedAt: c.syncedAt,
  createdAt: c.createdAt,
});

/**
 * As ligações dos Dados a uma API que enche uma tabela pela coluna chave (por agora a Shopify: as encomendas). A
 * chave fica cifrada e nunca volta ao browser. Sincronizam sozinhas no intervalo de cada uma (uma de cada vez, nunca
 * duas vezes ao mesmo tempo); uma que falha fica com o erro e tenta-se no intervalo seguinte.
 */
@Injectable()
export class CompanyDataConnectionService implements OnModuleInit, OnModuleDestroy {
  private readonly logger = new Logger(CompanyDataConnectionService.name);
  private readonly running = new Map<string, Promise<SyncResult>>();
  private firstCheck: NodeJS.Timeout | null = null;
  private timer: NodeJS.Timeout | null = null;
  private checking = false;

  constructor(
    private readonly repository: PrismaCompanyDataRepository,
    private readonly companyRepository: PrismaCompanyRepository,
  ) {}

  onModuleInit() {
    const delay = FIRST_CHECK_MIN_MS + Math.floor(Math.random() * FIRST_CHECK_JITTER_MS);
    this.firstCheck = setTimeout(() => {
      void this.checkDue();
      this.timer = setInterval(() => void this.checkDue(), CHECK_EVERY_MS);
    }, delay);
    this.firstCheck.unref();
  }

  onModuleDestroy() {
    if (this.firstCheck) clearTimeout(this.firstCheck);
    if (this.timer) clearInterval(this.timer);
  }

  private access(userId: string, companyId: string, permission: 'data.view' | 'data.manage') {
    return assertDataAccess(userId, companyId, this.companyRepository, permission);
  }

  private async connectionOf(companyId: string, id: string) {
    const connection = await this.repository.findConnection(id);
    if (!connection || connection.companyId !== companyId) throw new NotFoundException('Ligação não encontrada');
    return connection;
  }

  fields() {
    return { shopify: SHOPIFY_ORDER_FIELDS };
  }

  async list(userId: string, companyId: string) {
    await this.access(userId, companyId, 'data.view');
    return (await this.repository.findConnections(companyId)).map((c) => ({ ...connectionView(c), syncing: this.running.has(c.id) }));
  }

  async check(userId: string, companyId: string, dto: CheckDataConnectionDto) {
    await this.access(userId, companyId, 'data.manage');
    return checkShopifyShop(normalizeShop(dto.shop), dto.token.trim());
  }

  async create(userId: string, companyId: string, dto: CreateDataConnectionDto) {
    await this.access(userId, companyId, 'data.manage');
    const shop = normalizeShop(dto.shop);
    const token = dto.token.trim();
    if ((await this.repository.findConnections(companyId)).length >= MAX_CONNECTIONS) throw new BadRequestException(`No máximo ${MAX_CONNECTIONS} ligações`);
    await checkShopifyShop(shop, token);

    let tableId: string;
    let mapping: Record<string, string>;
    if (dto.tableId) {
      const table = await assertTableOfCompany(this.repository, companyId, dto.tableId);
      if ((await this.repository.findConnectionsUsingTable(table.id)).length) throw new ConflictException('Essa tabela já recebe outra ligação');
      mapping = assertConnectionMapping(dto.mapping ?? {}, table);
      tableId = table.id;
    } else {
      const name = (dto.newTableName ?? '').trim();
      if (!name) throw new BadRequestException('Escolhe a tabela ou dá o nome da nova');
      const made = columnsForFields(dto.fields ?? []);
      const table = await this.repository.createTable({
        companyId,
        name,
        source: 'api',
        columns: made.columns as unknown as Prisma.InputJsonValue,
        keyColumn: made.keyColumn,
        createdById: userId,
      });
      tableId = table.id;
      mapping = made.mapping;
    }

    const connection = await this.repository.transaction((tx) =>
      this.repository.createConnection(tx, {
        companyId,
        provider: dto.provider,
        tableId,
        baseUrl: shop,
        credentials: encryptSecret(token, credentialsContext(companyId)),
        mapping,
        syncEveryHours: dto.syncEveryHours ?? 1,
        createdById: userId,
      }),
    );
    // A primeira volta já, em fundo (lê as encomendas todas)
    void this.sync(connection.id).catch(() => undefined);
    return connectionView(connection);
  }

  async update(userId: string, companyId: string, id: string, dto: UpdateDataConnectionDto) {
    await this.access(userId, companyId, 'data.manage');
    const connection = await this.connectionOf(companyId, id);
    const data: Prisma.CompanyDataConnectionUncheckedUpdateInput = {};
    if (dto.status) data.status = dto.status;
    if (dto.syncEveryHours) data.syncEveryHours = dto.syncEveryHours;
    if (dto.mapping) {
      const table = await assertTableOfCompany(this.repository, companyId, connection.tableId);
      data.mapping = assertConnectionMapping(dto.mapping, table);
    }
    if (dto.token) {
      await checkShopifyShop(connection.baseUrl, dto.token.trim());
      data.credentials = encryptSecret(dto.token.trim(), credentialsContext(companyId));
      if (connection.status === 'error') data.status = 'active';
    }
    return connectionView(await this.repository.updateConnection(connection.id, data));
  }

  async remove(userId: string, companyId: string, id: string) {
    await this.access(userId, companyId, 'data.manage');
    const connection = await this.connectionOf(companyId, id);
    // A tabela e as linhas ficam (só deixam de se atualizar)
    await this.repository.deleteConnection(connection.id);
    return { ok: true };
  }

  async syncNow(userId: string, companyId: string, id: string) {
    await this.access(userId, companyId, 'data.manage');
    const connection = await this.connectionOf(companyId, id);
    if (connection.status === 'paused') throw new BadRequestException('A ligação está pausada');
    return this.sync(connection.id);
  }

  /** Sincroniza já (ou espera pela que já está a correr). */
  sync(id: string): Promise<SyncResult> {
    const current = this.running.get(id);
    if (current) return current;
    const run = this.run(id).finally(() => this.running.delete(id));
    this.running.set(id, run);
    return run;
  }

  private async run(id: string): Promise<SyncResult> {
    const connection = await this.repository.findConnection(id);
    if (!connection) throw new NotFoundException('Ligação não encontrada');
    try {
      const result = await syncDataConnection(this.repository, connection);
      await this.repository.updateConnection(id, { syncedAt: new Date(), lastError: null, ...(connection.status === 'error' ? { status: 'active' } : {}) });
      return result;
    } catch (error) {
      const message = error instanceof Error ? error.message : 'A sincronização falhou';
      // A pausada continua pausada; o syncedAt não mexe (a seguinte lê o que faltou)
      await this.repository.updateConnection(id, { lastError: message, ...(connection.status === 'paused' ? {} : { status: 'error' }) }).catch(() => undefined);
      throw error;
    }
  }

  private async checkDue() {
    if (this.checking) return;
    this.checking = true;
    try {
      const now = new Date();
      for (const connection of await this.repository.findActiveConnections()) {
        if (!isConnectionDue(connection, now)) continue;
        await this.sync(connection.id).catch((error: Error) => this.logger.warn(`Ligação ${connection.id}: ${error.message}`));
      }
    } catch (error) {
      this.logger.warn(`Ligações: ${(error as Error).message}`);
    } finally {
      this.checking = false;
    }
  }
}


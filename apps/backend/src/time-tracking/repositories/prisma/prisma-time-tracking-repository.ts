import { Injectable } from '@nestjs/common';
import { PrismaService } from 'src/prisma/prisma.service';
import { rateHourForDate } from 'src/currency/helpers/rateHourForDate';
import { ensureCompanyIncomeSource } from 'src/personal-income/helpers/ensureCompanyIncomeSource';
import { Prisma } from 'src/generated/prisma/client/client';
import {
  ClientRow,
  EntryFilter,
  EntryRow,
  PersonRow,
  ProjectRow,
  RatedEntry,
  StoredEntry,
  SyncedEntry,
} from '../time-tracking-repository';

const num = (value: Prisma.Decimal | null | undefined) => (value === null || value === undefined ? null : Number(value));

// Uma ligação para o ecrã: nunca a chave
const CONNECTION_VIEW = {
  id: true,
  companyId: true,
  provider: true,
  baseUrl: true,
  organizationId: true,
  organizationName: true,
  status: true,
  syncEveryHours: true,
  lastError: true,
  syncedAt: true,
  createdAt: true,
  currency: { select: { id: true, shortCode: true, symbol: true } },
  _count: { select: { clients: true, projects: true, people: true, entries: true } },
} satisfies Prisma.TimeTrackingConnectionSelect;

const RATED_ENTRY = {
  id: true,
  connectionId: true,
  start: true,
  end: true,
  seconds: true,
  description: true,
  billable: true,
  clientId: true,
  personId: true,
  client: { select: { id: true, name: true, hourlyRate: true, billing: true, withholdingPct: true } },
  project: { select: { id: true, name: true, color: true, billableRate: true, isBillable: true } },
  person: {
    select: {
      id: true,
      name: true,
      billableRate: true,
      memberId: true,
      userId: true,
      payRate: true,
      payWithholdingPct: true,
      member: { select: { userId: true } },
    },
  },
  allocations: { select: { seconds: true } },
  payoutAllocations: { select: { seconds: true } },
} satisfies Prisma.TimeTrackingEntrySelect;

type RatedEntryRecord = Prisma.TimeTrackingEntryGetPayload<{ select: typeof RATED_ENTRY }>;

const toRated = (row: RatedEntryRecord): RatedEntry => ({
  id: row.id,
  connectionId: row.connectionId,
  start: row.start,
  end: row.end,
  seconds: row.seconds,
  description: row.description,
  billable: row.billable,
  clientId: row.clientId,
  personId: row.personId,
  client: row.client
    ? { ...row.client, hourlyRate: num(row.client.hourlyRate), withholdingPct: num(row.client.withholdingPct) }
    : null,
  project: row.project ? { ...row.project, billableRate: num(row.project.billableRate) } : null,
  person: row.person
    ? {
        id: row.person.id,
        name: row.person.name,
        billableRate: num(row.person.billableRate),
        memberId: row.person.memberId,
        // A conta a quem vão os ganhos: a da pessoa ou a do membro dela
        userId: row.person.userId ?? row.person.member?.userId ?? null,
        payRate: num(row.person.payRate),
        payWithholdingPct: num(row.person.payWithholdingPct),
      }
    : null,
  paidSeconds: row.allocations.reduce((sum, allocation) => sum + allocation.seconds, 0),
  payoutSeconds: row.payoutAllocations.reduce((sum, allocation) => sum + allocation.seconds, 0),
});

// Uma liquidação para o ecrã: o cliente, a pessoa e o recebimento (o cliente pagou à empresa)
const SETTLEMENT_VIEW = {
  client: { select: { id: true, name: true } },
  person: { select: { id: true, name: true } },
  company: { select: { id: true, name: true, slug: true } },
  currency: { select: { id: true, shortCode: true, symbol: true } },
  companyPayment: { select: { id: true, amount: true, status: true } },
  allocations: { select: { seconds: true } },
} satisfies Prisma.TimeTrackingSettlementInclude;

// Um pagamento a quem fez as horas, para o ecrã
const PAYOUT_VIEW = {
  person: { select: { id: true, name: true } },
  user: { select: { id: true, fullName: true } },
  company: { select: { id: true, name: true, slug: true } },
  currency: { select: { id: true, shortCode: true, symbol: true } },
  companyPayment: { select: { id: true, amount: true, status: true } },
  personalIncome: { select: { id: true, amount: true, status: true } },
} satisfies Prisma.TimeTrackingPayoutInclude;

// Quantas escritas vão de cada vez numa transação
const CHUNK = 200;
// Quantos registos novos vão num só createMany
const CREATE_CHUNK = 1000;

@Injectable()
export class PrismaTimeTrackingRepository {
  constructor(private readonly prisma: PrismaService) {}

  findCurrencyByCode(code: string) {
    return this.prisma.currency.findFirst({ where: { shortCode: code.toUpperCase() } });
  }

  // --- ligações ---

  findConnections(companyId: string) {
    return this.prisma.timeTrackingConnection.findMany({
      where: { companyId },
      select: CONNECTION_VIEW,
      orderBy: { createdAt: 'asc' },
    });
  }

  findConnectionView(companyId: string, id: string) {
    return this.prisma.timeTrackingConnection.findFirst({ where: { id, companyId }, select: CONNECTION_VIEW });
  }

  /** Com a chave (cifrada): só para o backend. */
  findConnection(id: string) {
    return this.prisma.timeTrackingConnection.findUnique({ where: { id } });
  }

  findConnectionByOrganization(companyId: string, provider: string, baseUrl: string, organizationId: string) {
    return this.prisma.timeTrackingConnection.findUnique({
      where: { companyId_provider_baseUrl_organizationId: { companyId, provider, baseUrl, organizationId } },
    });
  }

  /** As que podem sincronizar sozinhas (as pausadas não; de empresas apagadas também não). */
  findConnectionsToSync() {
    return this.prisma.timeTrackingConnection.findMany({
      where: { status: { not: 'paused' }, company: { status: { not: 'deleted' } } },
      select: { id: true, syncedAt: true, syncEveryHours: true },
    });
  }

  createConnection(data: Prisma.TimeTrackingConnectionUncheckedCreateInput) {
    return this.prisma.timeTrackingConnection.create({ data });
  }

  updateConnection(id: string, data: Prisma.TimeTrackingConnectionUncheckedUpdateInput) {
    return this.prisma.timeTrackingConnection.update({ where: { id }, data });
  }

  countConnectionSettlements(connectionId: string) {
    return this.prisma.timeTrackingSettlement.count({ where: { client: { connectionId } } });
  }

  /** Os pagamentos a quem fez as horas que vêm de pessoas desta ligação. */
  countConnectionPayouts(connectionId: string) {
    return this.prisma.timeTrackingPayout.count({ where: { person: { connectionId } } });
  }

  deleteConnection(id: string) {
    return this.prisma.timeTrackingConnection.delete({ where: { id } });
  }

  // --- sincronização ---

  async upsertClients(connectionId: string, rows: ClientRow[]) {
    for (let i = 0; i < rows.length; i += CHUNK)
      await this.prisma.$transaction(
        rows.slice(i, i + CHUNK).map((row) =>
          this.prisma.timeTrackingClient.upsert({
            where: { connectionId_externalId: { connectionId, externalId: row.externalId } },
            create: { connectionId, ...row },
            update: { name: row.name, isArchived: row.isArchived },
          }),
        ),
      );
    return this.idsByExternal('client', connectionId);
  }

  async upsertProjects(connectionId: string, rows: ProjectRow[], clientIds: Map<string, string>) {
    for (let i = 0; i < rows.length; i += CHUNK)
      await this.prisma.$transaction(
        rows.slice(i, i + CHUNK).map(({ clientExternalId, ...row }) => {
          const fields = { ...row, clientId: clientExternalId ? (clientIds.get(clientExternalId) ?? null) : null };
          return this.prisma.timeTrackingProject.upsert({
            where: { connectionId_externalId: { connectionId, externalId: row.externalId } },
            create: { connectionId, ...fields },
            update: fields,
          });
        }),
      );
    return this.prisma.timeTrackingProject.findMany({
      where: { connectionId },
      select: { id: true, externalId: true, clientId: true },
    });
  }

  async upsertPeople(connectionId: string, rows: PersonRow[]) {
    for (let i = 0; i < rows.length; i += CHUNK)
      await this.prisma.$transaction(
        rows.slice(i, i + CHUNK).map((row) =>
          this.prisma.timeTrackingPerson.upsert({
            where: { connectionId_externalId: { connectionId, externalId: row.externalId } },
            create: { connectionId, ...row },
            update: { name: row.name, billableRate: row.billableRate },
          }),
        ),
      );
    return this.idsByExternal('person', connectionId);
  }

  private async idsByExternal(kind: 'client' | 'person', connectionId: string) {
    const rows =
      kind === 'client'
        ? await this.prisma.timeTrackingClient.findMany({ where: { connectionId }, select: { id: true, externalId: true } })
        : await this.prisma.timeTrackingPerson.findMany({ where: { connectionId }, select: { id: true, externalId: true } });
    return new Map(rows.map((row) => [row.externalId, row.id]));
  }

  /** A pessoa da app que é este utilizador dela, para a ligar ao membro (só se ainda não tiver). */
  linkPerson(connectionId: string, externalId: string, link: { memberId: string | null; userId: string }) {
    return this.prisma.timeTrackingPerson.updateMany({
      where: { connectionId, externalId, memberId: null, userId: null },
      data: link,
    });
  }

  findCompanyOwner(companyId: string) {
    return this.prisma.company.findUnique({
      where: { id: companyId },
      select: { createdBy: { select: { id: true, fullName: true } } },
    });
  }

  /**
   * Grava os registos que vieram da app, só os novos (de uma vez) e os que mudaram: a maior parte
   * das voltas não muda nada. Um registo já pago que na app passou para outro cliente (ou, pago à
   * pessoa, para outra pessoa) fica aqui com o cliente e o projeto (ou a pessoa) de antes, para as
   * liquidações e os pagamentos não ficarem com horas de outro; um que encolheu abaixo do que já
   * está pago grava-se como está na app (as contas não passam das horas dele). Os dois contam-se
   * nos avisos, para o `lastError`.
   */
  async syncEntries(connectionId: string, rows: SyncedEntry[]) {
    const stored = new Map<string, StoredEntry>();
    if (rows.length) {
      const externalIds = rows.map((row) => row.externalId);
      const found = await this.prisma.$queryRaw<StoredEntry[]>`
        SELECT e."id", e."externalId", e."projectId", e."clientId", e."personId", e."start", e."end",
          e."seconds", e."description", e."billable",
          COALESCE((SELECT SUM(a."seconds") FROM "TimeTrackingAllocation" a WHERE a."entryId" = e."id"), 0)::int AS "paidSeconds",
          COALESCE((SELECT SUM(p."seconds") FROM "TimeTrackingPayoutAllocation" p WHERE p."entryId" = e."id"), 0)::int AS "payoutSeconds"
        FROM "TimeTrackingEntry" e
        WHERE e."connectionId" = ${connectionId} AND e."externalId" = ANY(${externalIds}::text[])`;
      for (const row of found) stored.set(row.externalId, row);
    }

    const creates: Prisma.TimeTrackingEntryCreateManyInput[] = [];
    const updates: { id: string; data: Omit<SyncedEntry, 'externalId'> }[] = [];
    let moved = 0;
    let shrunk = 0;
    for (const { externalId, ...incoming } of rows) {
      const old = stored.get(externalId);
      if (!old) {
        creates.push({ connectionId, externalId, ...incoming });
        continue;
      }
      const next = { ...incoming };
      let wasMoved = false;
      if (old.paidSeconds > 0 && next.clientId !== old.clientId) {
        next.clientId = old.clientId;
        next.projectId = old.projectId;
        wasMoved = true;
      }
      if (old.payoutSeconds > 0 && next.personId !== old.personId) {
        next.personId = old.personId;
        wasMoved = true;
      }
      if (wasMoved) moved++;
      if (Math.max(old.paidSeconds, old.payoutSeconds) > next.seconds) shrunk++;
      const changed =
        next.projectId !== old.projectId ||
        next.clientId !== old.clientId ||
        next.personId !== old.personId ||
        next.start.getTime() !== old.start.getTime() ||
        (next.end?.getTime() ?? null) !== (old.end?.getTime() ?? null) ||
        next.seconds !== old.seconds ||
        next.description !== old.description ||
        next.billable !== old.billable;
      if (changed) updates.push({ id: old.id, data: next });
    }

    for (let i = 0; i < creates.length; i += CREATE_CHUNK)
      await this.prisma.timeTrackingEntry.createMany({ data: creates.slice(i, i + CREATE_CHUNK), skipDuplicates: true });
    for (let i = 0; i < updates.length; i += CHUNK)
      await this.prisma.$transaction(
        updates
          .slice(i, i + CHUNK)
          .map(({ id, data }) => this.prisma.timeTrackingEntry.update({ where: { id }, data })),
      );
    return { created: creates.length, updated: updates.length, moved, shrunk };
  }

  /**
   * Os registos desde `since` que já não vêm da app: saem, menos os que já têm horas pagas pelo
   * cliente ou à pessoa (ficam, para os pagamentos não perderem o que pagaram). Devolve quantos
   * saíram e quantos pagos ficaram sem estar na app.
   */
  async deleteMissingEntries(connectionId: string, since: Date | null, keep: string[]) {
    const missing = Prisma.sql`e."connectionId" = ${connectionId}
      ${since ? Prisma.sql`AND e."start" >= ${since}` : Prisma.empty}
      AND e."externalId" <> ALL(${keep}::text[])`;
    const removed = await this.prisma.$executeRaw`
      DELETE FROM "TimeTrackingEntry" e
      WHERE ${missing}
        AND NOT EXISTS (SELECT 1 FROM "TimeTrackingAllocation" a WHERE a."entryId" = e."id")
        AND NOT EXISTS (SELECT 1 FROM "TimeTrackingPayoutAllocation" p WHERE p."entryId" = e."id")`;
    const [left] = await this.prisma.$queryRaw<{ count: number }[]>`
      SELECT COUNT(*)::int AS "count" FROM "TimeTrackingEntry" e WHERE ${missing}`;
    return { removed, keptPaid: left?.count ?? 0 };
  }

  // --- membros e clientes da empresa ---

  /** O membro ativo desta conta na empresa (os convidados e os que recusaram não contam). */
  findMemberOfUser(companyId: string, userId: string) {
    return this.prisma.companyMember.findFirst({ where: { companyId, userId, status: 'active' }, select: { id: true } });
  }

  findMember(companyId: string, memberId: string) {
    return this.prisma.companyMember.findFirst({ where: { companyId, id: memberId }, select: { id: true, userId: true } });
  }

  findSupplier(companyId: string, supplierId: string) {
    return this.prisma.companySupplier.findFirst({ where: { companyId, id: supplierId }, select: { id: true } });
  }

  findClients(companyId: string) {
    return this.prisma.timeTrackingClient.findMany({
      where: { connection: { companyId } },
      include: {
        supplier: { select: { id: true, name: true, slug: true } },
        connection: { select: { id: true, organizationName: true } },
        projects: {
          select: { id: true, name: true, color: true, billableRate: true, isBillable: true, isArchived: true },
          orderBy: { name: 'asc' },
        },
      },
      orderBy: [{ isArchived: 'asc' }, { name: 'asc' }],
    });
  }

  findClient(companyId: string, clientId: string) {
    return this.prisma.timeTrackingClient.findFirst({ where: { id: clientId, connection: { companyId } } });
  }

  updateClient(id: string, data: Prisma.TimeTrackingClientUncheckedUpdateInput) {
    return this.prisma.timeTrackingClient.update({ where: { id }, data });
  }

  findPeople(companyId: string) {
    return this.prisma.timeTrackingPerson.findMany({
      where: { connection: { companyId } },
      include: {
        member: { select: { id: true, name: true, user: { select: { id: true, fullName: true } } } },
        user: { select: { id: true, fullName: true } },
        connection: { select: { id: true, organizationName: true } },
      },
      orderBy: { name: 'asc' },
    });
  }

  findPerson(companyId: string, personId: string) {
    return this.prisma.timeTrackingPerson.findFirst({ where: { id: personId, connection: { companyId } } });
  }

  updatePerson(
    id: string,
    data: { memberId?: string | null; userId?: string | null; payRate?: number | null; payWithholdingPct?: number | null },
  ) {
    return this.prisma.timeTrackingPerson.update({ where: { id }, data });
  }

  // --- registos ---

  private entryWhere(filter: EntryFilter): Prisma.TimeTrackingEntryWhereInput {
    return {
      connection: { companyId: filter.companyId },
      ...(filter.connectionId ? { connectionId: filter.connectionId } : {}),
      ...(filter.clientId ? { clientId: filter.clientId } : {}),
      ...(filter.personId ? { personId: filter.personId } : {}),
      ...(filter.from || filter.to
        ? { start: { ...(filter.from ? { gte: filter.from } : {}), ...(filter.to ? { lt: filter.to } : {}) } }
        : {}),
    };
  }

  async findEntries(filter: EntryFilter): Promise<RatedEntry[]> {
    const rows = await this.prisma.timeTrackingEntry.findMany({
      where: this.entryWhere(filter),
      select: RATED_ENTRY,
      orderBy: { start: 'desc' },
    });
    return rows.map(toRated);
  }

  /**
   * Os registos às páginas, do mais recente. `paid` são os pagos por inteiro e `unpaid` os que
   * ainda têm horas por pagar (os pagos em parte contam aqui), pela soma das alocações. Os dois só
   * veem os que se cobram (faturável, num projeto faturável, de um cliente que se cobra, como o
   * `entryBillable`) e com horas: um não faturável ou de 0 s não está por pagar nem pago.
   */
  async findEntriesPage(filter: EntryFilter, status: 'paid' | 'unpaid' | undefined, skip: number, take: number) {
    if (!status) {
      const where = this.entryWhere(filter);
      const [rows, total] = await Promise.all([
        this.prisma.timeTrackingEntry.findMany({ where, select: RATED_ENTRY, orderBy: { start: 'desc' }, skip, take }),
        this.prisma.timeTrackingEntry.count({ where }),
      ]);
      return { rows: rows.map(toRated), total };
    }
    const conditions = [
      Prisma.sql`c."companyId" = ${filter.companyId}`,
      Prisma.sql`e."billable" AND e."seconds" > 0`,
      Prisma.sql`COALESCE(p."isBillable", true) AND COALESCE(cl."billing", '') <> 'none'`,
    ];
    if (filter.connectionId) conditions.push(Prisma.sql`e."connectionId" = ${filter.connectionId}`);
    if (filter.clientId) conditions.push(Prisma.sql`e."clientId" = ${filter.clientId}`);
    if (filter.personId) conditions.push(Prisma.sql`e."personId" = ${filter.personId}`);
    if (filter.from) conditions.push(Prisma.sql`e."start" >= ${filter.from}`);
    if (filter.to) conditions.push(Prisma.sql`e."start" < ${filter.to}`);
    const paid = Prisma.sql`COALESCE((SELECT SUM(a."seconds") FROM "TimeTrackingAllocation" a WHERE a."entryId" = e."id"), 0)`;
    conditions.push(status === 'paid' ? Prisma.sql`${paid} >= e."seconds"` : Prisma.sql`${paid} < e."seconds"`);
    const from = Prisma.sql`"TimeTrackingEntry" e
      JOIN "TimeTrackingConnection" c ON c."id" = e."connectionId"
      LEFT JOIN "TimeTrackingProject" p ON p."id" = e."projectId"
      LEFT JOIN "TimeTrackingClient" cl ON cl."id" = e."clientId"
      WHERE ${Prisma.join(conditions, ' AND ')}`;
    const [ids, [count]] = await Promise.all([
      this.prisma.$queryRaw<{ id: string }[]>`
        SELECT e."id" FROM ${from} ORDER BY e."start" DESC, e."id" DESC LIMIT ${take} OFFSET ${skip}`,
      this.prisma.$queryRaw<{ total: number }[]>`SELECT COUNT(*)::int AS "total" FROM ${from}`,
    ]);
    const rows = ids.length
      ? await this.prisma.timeTrackingEntry.findMany({
          where: { id: { in: ids.map((row) => row.id) } },
          select: RATED_ENTRY,
          orderBy: [{ start: 'desc' }, { id: 'desc' }],
        })
      : [];
    return { rows: rows.map(toRated), total: count?.total ?? 0 };
  }

  // --- liquidações ---

  /** O cliente com a moeda da ligação e o cliente da empresa (fornecedor) a que está ligado. */
  findClientForSettlement(companyId: string, clientId: string) {
    return this.prisma.timeTrackingClient.findFirst({
      where: { id: clientId, connection: { companyId } },
      include: {
        supplier: { select: { id: true, name: true } },
        connection: { select: { id: true, currencyId: true, company: { select: { id: true, name: true } } } },
      },
    });
  }

  findPersonOfConnection(connectionId: string, personId: string) {
    return this.prisma.timeTrackingPerson.findFirst({
      where: { id: personId, connectionId },
      include: { member: { select: { id: true, userId: true } } },
    });
  }

  /** Os registos de um cliente (e de uma pessoa), do mais antigo, para alocar por ordem. */
  async findClientEntries(clientId: string, personId?: string | null, from?: Date, to?: Date): Promise<RatedEntry[]> {
    const rows = await this.prisma.timeTrackingEntry.findMany({
      where: {
        clientId,
        ...(personId ? { personId } : {}),
        ...(from || to ? { start: { ...(from ? { gte: from } : {}), ...(to ? { lt: to } : {}) } } : {}),
      },
      select: RATED_ENTRY,
      orderBy: [{ start: 'asc' }, { id: 'asc' }],
    });
    return rows.map(toRated);
  }

  /** Uns registos escolhidos, da empresa, do mais antigo. */
  async findEntriesByIds(companyId: string, ids: string[]): Promise<RatedEntry[]> {
    const rows = await this.prisma.timeTrackingEntry.findMany({
      where: { id: { in: ids }, connection: { companyId } },
      select: RATED_ENTRY,
      orderBy: [{ start: 'asc' }, { id: 'asc' }],
    });
    return rows.map(toRated);
  }

  /** Os registos de uma pessoa (num intervalo), do mais antigo, para lhe pagar. */
  async findPersonEntries(personId: string, from?: Date, to?: Date): Promise<RatedEntry[]> {
    const rows = await this.prisma.timeTrackingEntry.findMany({
      where: {
        personId,
        ...(from || to ? { start: { ...(from ? { gte: from } : {}), ...(to ? { lt: to } : {}) } } : {}),
      },
      select: RATED_ENTRY,
      orderBy: [{ start: 'asc' }, { id: 'asc' }],
    });
    return rows.map(toRated);
  }

  // --- pagamentos a quem fez as horas ---

  findPersonForPayout(companyId: string, personId: string) {
    return this.prisma.timeTrackingPerson.findFirst({
      where: { id: personId, connection: { companyId } },
      include: {
        member: { select: { id: true, userId: true } },
        connection: { select: { currencyId: true, company: { select: { id: true, name: true, createdById: true } } } },
      },
    });
  }

  createPayout(data: Prisma.TimeTrackingPayoutUncheckedCreateInput, allocations: { entryId: string; seconds: number }[]) {
    return this.prisma.timeTrackingPayout.create({ data: { ...data, allocations: { create: allocations } } });
  }

  /** O ganho de um pagamento a quem fez as horas: fica também confirmado (`received`). */
  linkPayoutIncome(payoutId: string, personalIncomeId: string) {
    return this.prisma.timeTrackingPayout.update({
      where: { id: payoutId },
      data: { personalIncomeId, confirmation: 'received', respondedAt: new Date() },
    });
  }

  /**
   * A resposta de quem recebeu um pagamento das horas: `received` (recebi) ou `declined` (não
   * recebi). Só a primeira conta: devolve 0 se o pagamento já tinha resposta.
   */
  async markPayoutAnswered(payoutId: string, confirmation: 'received' | 'declined') {
    const result = await this.prisma.timeTrackingPayout.updateMany({
      where: { id: payoutId, confirmation: null },
      data: { confirmation, respondedAt: new Date() },
    });
    return result.count;
  }

  findPayoutsList(companyId: string, filter: { personId?: string }) {
    return this.prisma.timeTrackingPayout.findMany({
      where: { companyId, ...(filter.personId ? { personId: filter.personId } : {}) },
      include: PAYOUT_VIEW,
      orderBy: [{ paidAt: 'desc' }, { createdAt: 'desc' }],
    });
  }

  findPayoutView(id: string) {
    return this.prisma.timeTrackingPayout.findUnique({ where: { id }, include: PAYOUT_VIEW });
  }

  findPayout(companyId: string, id: string) {
    return this.prisma.timeTrackingPayout.findFirst({
      where: { id, companyId },
      include: { personalIncome: { select: { id: true, userId: true } } },
    });
  }

  deletePayout(id: string) {
    return this.prisma.timeTrackingPayout.delete({ where: { id } });
  }

  /**
   * O que as empresas já pagaram a esta conta e ela ainda não respondeu (para os ganhos esperados):
   * sem ganho e sem resposta — um «não recebi» (`declined`) sai daqui.
   */
  findUnconfirmedPayouts(userId: string) {
    return this.prisma.timeTrackingPayout.findMany({
      where: { userId, personalIncomeId: null, confirmation: null, company: { status: { not: 'deleted' } } },
      include: {
        company: { select: { id: true, name: true, slug: true } },
        currency: { select: { id: true, shortCode: true, symbol: true, rate: true } },
      },
      orderBy: { paidAt: 'asc' },
    });
  }

  createSettlement(
    data: Prisma.TimeTrackingSettlementUncheckedCreateInput,
    allocations: { entryId: string; seconds: number }[],
  ) {
    return this.prisma.timeTrackingSettlement.create({
      data: { ...data, allocations: { create: allocations } },
    });
  }

  /**
   * Junta segundos a uma liquidação (o saldo adiantado a gastar-se em horas novas). Corre dentro
   * do `locked` (a transação dele), por isso um a seguir ao outro.
   */
  async addAllocations(settlementId: string, allocations: { entryId: string; seconds: number }[]) {
    for (const allocation of allocations)
      await this.prisma.timeTrackingAllocation.upsert({
        where: { settlementId_entryId: { settlementId, entryId: allocation.entryId } },
        create: { settlementId, ...allocation },
        update: { seconds: { increment: allocation.seconds } },
      });
  }

  /**
   * Corre `work` numa transação com um advisory lock (`key`, como `settle:<cliente>` ou
   * `payout:<pessoa>`): dois pedidos com a mesma chave esperam um pelo outro, e o segundo já lê
   * as alocações que o primeiro gravou. O `work` recebe o repositório dentro da transação.
   */
  locked<T>(key: string, work: (repository: PrismaTimeTrackingRepository) => Promise<T>): Promise<T> {
    return this.prisma.$transaction(
      async (tx) => {
        await tx.$executeRaw`SELECT pg_advisory_xact_lock(hashtext(${`time-tracking:${key}`}::text))`;
        return work(new PrismaTimeTrackingRepository(tx as unknown as PrismaService));
      },
      { maxWait: 10_000, timeout: 30_000 },
    );
  }

  setSettlementPayment(settlementId: string, companyPaymentId: string) {
    return this.prisma.timeTrackingSettlement.update({ where: { id: settlementId }, data: { companyPaymentId } });
  }

  setPayoutPayment(payoutId: string, companyPaymentId: string) {
    return this.prisma.timeTrackingPayout.update({ where: { id: payoutId }, data: { companyPaymentId } });
  }

  /** Quantos segundos de uma liquidação já estão alocados a registos. */
  async settlementAllocatedSeconds(settlementId: string) {
    const result = await this.prisma.timeTrackingAllocation.aggregate({
      where: { settlementId },
      _sum: { seconds: true },
    });
    return result._sum.seconds ?? 0;
  }

  /** As liquidações por horas de uma ligação que ainda têm horas adiantadas. */
  async findSettlementsWithCredit(connectionId: string) {
    const rows = await this.prisma.timeTrackingSettlement.findMany({
      where: { mode: 'hours', client: { connectionId } },
      select: {
        id: true,
        clientId: true,
        personId: true,
        fromDate: true,
        seconds: true,
        createdAt: true,
        allocations: { select: { seconds: true } },
      },
      orderBy: [{ paidAt: 'asc' }, { createdAt: 'asc' }],
    });
    return rows
      .map(({ allocations, ...row }) => ({ ...row, allocated: allocations.reduce((sum, a) => sum + a.seconds, 0) }))
      .filter((row) => row.allocated < row.seconds);
  }

  /** As liquidações de uma empresa (sempre de uma: o `companyId` é obrigatório). */
  findSettlementsList(companyId: string, filter: { clientId?: string; personId?: string }) {
    if (!companyId) throw new Error('findSettlementsList sem companyId');
    return this.prisma.timeTrackingSettlement.findMany({
      where: {
        companyId,
        ...(filter.clientId ? { clientId: filter.clientId } : {}),
        ...(filter.personId ? { personId: filter.personId } : {}),
      },
      include: SETTLEMENT_VIEW,
      orderBy: [{ paidAt: 'desc' }, { createdAt: 'desc' }],
    });
  }

  findSettlementView(id: string) {
    return this.prisma.timeTrackingSettlement.findUnique({ where: { id }, include: SETTLEMENT_VIEW });
  }

  findSettlement(companyId: string, id: string) {
    return this.prisma.timeTrackingSettlement.findFirst({ where: { id, companyId } });
  }

  deleteSettlement(id: string) {
    return this.prisma.timeTrackingSettlement.delete({ where: { id } });
  }

  deletePersonalIncome(id: string) {
    return this.prisma.personalIncome.delete({ where: { id } });
  }

  /** O ganho pessoal das horas pagas: quem paga é a empresa (a fonte dela na pessoa). */
  async createPersonalIncome(
    data: Omit<Prisma.PersonalIncomeUncheckedCreateInput, 'sourceId'>,
    company: { id: string; name: string },
  ) {
    const sourceId = await ensureCompanyIncomeSource(this.prisma, data.userId, company);
    return this.prisma.personalIncome.create({
      data: { ...data, sourceId, rateHour: await rateHourForDate(this.prisma, data.date) },
    });
  }

  /** As liquidações (pagamentos) num intervalo de dias de pagamento. */
  findSettlements(companyId: string, from?: Date, to?: Date) {
    return this.prisma.timeTrackingSettlement.findMany({
      where: {
        companyId,
        ...(from || to ? { paidAt: { ...(from ? { gte: from } : {}), ...(to ? { lt: to } : {}) } } : {}),
      },
      include: { client: { select: { id: true, name: true } } },
      orderBy: { paidAt: 'desc' },
    });
  }

  /** As horas das pessoas ligadas a este utilizador (como membro ou dono), em empresas que não foram apagadas. */
  async findUserEntries(userId: string, from: Date): Promise<(RatedEntry & { company: { id: string; name: string; slug: string }; currency: { id: string; shortCode: string; symbol: string; rate: number } })[]> {
    const rows = await this.prisma.timeTrackingEntry.findMany({
      where: {
        start: { gte: from },
        person: { OR: [{ userId }, { member: { userId, status: 'active' } }] },
        connection: { company: { status: { not: 'deleted' } } },
      },
      select: {
        ...RATED_ENTRY,
        connection: {
          select: {
            company: { select: { id: true, name: true, slug: true } },
            currency: { select: { id: true, shortCode: true, symbol: true, rate: true } },
          },
        },
      },
    });
    return rows.map((row) => ({ ...toRated(row), company: row.connection.company, currency: row.connection.currency }));
  }
}

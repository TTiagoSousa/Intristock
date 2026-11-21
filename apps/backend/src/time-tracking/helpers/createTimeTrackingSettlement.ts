import { BadRequestException, Logger, NotFoundException } from '@nestjs/common';
import { PrismaCompanyRepository } from 'src/company/repositories/prisma/prisma-company-repository';
import { PrismaTimeTrackingRepository } from '../repositories/prisma/prisma-time-tracking-repository';
import { CreateTimeTrackingSettlementDto } from '../dto/time-tracking.dto';
import { RatedEntry } from '../repositories/time-tracking-repository';
import { assertTimesheetAccess } from './assertTimesheetAccess';
import { allocateSeconds } from './allocateSeconds';
import { entryBillable, entryValue } from './entryValue';
import { localDay, resolveTimezone } from './localDay';
import { settlementView } from './settlementView';

const round = (value: number, places = 2) => Math.round(value * 10 ** places) / 10 ** places;
const DAY_MS = 24 * 60 * 60 * 1000;
const logger = new Logger('createTimeTrackingSettlement');

/** Os recebimentos da empresa (o `CompanyPaymentService`, com as permissões dele). */
export type SettlementPayments = {
  create(
    userId: string,
    companyId: string,
    dto: Record<string, unknown>,
    options?: { skipMemberHook?: boolean },
  ): Promise<{ id: string }>;
  remove(userId: string, companyId: string, paymentId: string): Promise<unknown>;
};

/**
 * O cliente pagou à empresa (ver o DTO): as horas ficam pagas pelo cliente. Não mexe nas finanças
 * pessoais de ninguém — o que a empresa paga a quem fez as horas é outro pagamento (`payouts`).
 * Com `toBankAccountId` grava também o recebimento na empresa, do cliente da empresa ligado.
 */
export async function createTimeTrackingSettlement(
  userId: string,
  companyId: string,
  dto: CreateTimeTrackingSettlementDto,
  repository: PrismaTimeTrackingRepository,
  companyRepository: PrismaCompanyRepository,
  payments: SettlementPayments,
) {
  await assertTimesheetAccess(userId, companyId, companyRepository, true);
  const client = await repository.findClientForSettlement(companyId, dto.clientId);
  if (!client) throw new NotFoundException('Cliente não encontrado');
  if (client.billing === 'none') throw new BadRequestException('Este cliente está marcado como «não se cobra»');

  const person = dto.personId ? await repository.findPersonOfConnection(client.connection.id, dto.personId) : null;
  if (dto.personId && !person) throw new BadRequestException('Essa pessoa não é desta ligação');
  if (dto.fromDate && dto.toDate && dto.fromDate > dto.toDate)
    throw new BadRequestException('A data de início é depois da de fim');

  // O recebimento precisa do cliente da empresa: vê-se antes de gravar alguma coisa
  if (dto.toBankAccountId && !client.supplierId)
    throw new BadRequestException('Liga este cliente a um cliente da empresa para gravar o recebimento');

  const timeZone = resolveTimezone(dto.tz);
  const inDays = (entry: RatedEntry) => {
    const day = localDay(entry.start, timeZone);
    return (!dto.fromDate || day >= dto.fromDate) && (!dto.toDate || day <= dto.toDate);
  };
  const from = dto.fromDate ? new Date(new Date(`${dto.fromDate}T00:00:00Z`).getTime() - DAY_MS) : undefined;
  const to = dto.toDate ? new Date(new Date(`${dto.toDate}T00:00:00Z`).getTime() + 2 * DAY_MS) : undefined;

  // A leitura das horas por pagar e as alocações numa transação com o cadeado do cliente: dois
  // pedidos ao mesmo tempo (um clique duplo) não pagam as mesmas horas — o segundo já vê as do
  // primeiro e, se não sobrar nada, é recusado
  const created = await repository.locked(`settle:${client.id}`, async (tx) => {
    const candidates =
      dto.mode === 'entries'
        ? await tx.findEntriesByIds(companyId, dto.entryIds!)
        : await tx.findClientEntries(client.id, person?.id, from, to);
    if (dto.mode === 'entries' && candidates.some((entry) => entry.clientId !== client.id))
      throw new BadRequestException('Os registos escolhidos têm de ser todos deste cliente');
    const open = candidates.filter(
      (entry) => (dto.mode === 'entries' || inDays(entry)) && entryBillable(entry) && entry.paidSeconds < entry.seconds,
    );

    let seconds: number;
    let gross: number;
    if (dto.mode === 'range' || dto.mode === 'entries') {
      seconds = open.reduce((sum, entry) => sum + entryValue(entry).unpaidSeconds, 0);
      if (seconds <= 0) throw new BadRequestException('Não há horas por pagar desse cliente nesses registos ou datas');
      gross = dto.amount ?? open.reduce((sum, entry) => sum + entryValue(entry).unpaidAmount, 0);
    } else {
      seconds = Math.round(dto.hours! * 3600);
      gross = dto.amount!;
    }
    gross = round(gross);
    const { allocations } = allocateSeconds(open, seconds);
    // As datas que cobre: as do pedido ou, nos registos escolhidos, a do primeiro e a do último
    const days = open.map((entry) => localDay(entry.start, timeZone)).sort();
    const firstDay = dto.mode === 'entries' ? days[0] : dto.fromDate;
    const lastDay = dto.mode === 'entries' ? days[days.length - 1] : dto.mode === 'range' ? dto.toDate : undefined;

    // A pessoa: a escolhida ou, sem ela, a única pessoa das horas pagas
    const personIds = new Set(
      open.filter((entry) => allocations.some((a) => a.entryId === entry.id)).map((entry) => entry.personId),
    );
    const onlyPerson =
      person ??
      (personIds.size === 1 && [...personIds][0]
        ? await tx.findPersonOfConnection(client.connection.id, [...personIds][0]!)
        : null);

    const withholdingPct =
      dto.withholdingPct !== undefined
        ? dto.withholdingPct
        : client.billing === 'freelance' && client.withholdingPct !== null
          ? Number(client.withholdingPct)
          : null;
    const net = round(gross * (1 - (withholdingPct ?? 0) / 100));

    const settlement = await tx.createSettlement(
      {
        companyId,
        clientId: client.id,
        personId: onlyPerson?.id ?? null,
        mode: dto.mode,
        fromDate: firstDay ? new Date(`${firstDay}T00:00:00Z`) : null,
        toDate: lastDay ? new Date(`${lastDay}T00:00:00Z`) : null,
        seconds,
        hourlyRate: round(gross / (seconds / 3600), 4),
        grossAmount: gross,
        withholdingPct,
        netAmount: net,
        currencyId: client.connection.currencyId,
        paidAt: new Date(`${dto.paidAt}T00:00:00Z`),
        note: dto.note?.trim() || null,
        createdById: userId,
      },
      allocations,
    );
    return { id: settlement.id, seconds, net };
  });

  // O recebimento na empresa vai pelo serviço dos pagamentos (outra transação, com as permissões
  // dele): se for recusado (permissões, conta) ou falhar a ligação, a liquidação desfaz-se
  if (dto.toBankAccountId) {
    let companyPaymentId: string | null = null;
    try {
      const payment = await payments.create(userId, companyId, {
        paymentType: 'receive',
        partyType: 'supplier',
        supplierId: client.supplierId,
        toBankAccountId: dto.toBankAccountId,
        amount: created.net,
        currencyId: client.connection.currencyId,
        paymentDate: dto.paidAt,
        status: 'completed',
        description: `Banco de horas · ${client.name} · ${round(created.seconds / 3600)} h`,
      });
      companyPaymentId = payment.id;
      await repository.setSettlementPayment(created.id, payment.id);
    } catch (error) {
      await repository.deleteSettlement(created.id).catch((cause) => logger.error(`Liquidação ${created.id} por desfazer: ${(cause as Error).message}`));
      if (companyPaymentId)
        await payments.remove(userId, companyId, companyPaymentId).catch((cause) => logger.error(`Recebimento ${companyPaymentId} por desfazer: ${(cause as Error).message}`));
      throw error;
    }
  }

  return settlementView((await repository.findSettlementView(created.id))!);
}

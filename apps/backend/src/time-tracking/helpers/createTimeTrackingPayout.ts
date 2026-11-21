import { BadRequestException, Logger, NotFoundException } from '@nestjs/common';
import { PrismaCompanyRepository } from 'src/company/repositories/prisma/prisma-company-repository';
import { PrismaTimeTrackingRepository } from '../repositories/prisma/prisma-time-tracking-repository';
import { CreateTimeTrackingPayoutDto } from '../dto/time-tracking.dto';
import { assertTimesheetAccess } from './assertTimesheetAccess';
import { SettlementPayments } from './createTimeTrackingSettlement';
import { entryPayValue } from './entryPayValue';
import { localDay, resolveTimezone } from './localDay';
import { payoutView } from './payoutView';
import { payoutIncomeDescription } from './payoutIncomeDescription';

const round = (value: number, places = 2) => Math.round(value * 10 ** places) / 10 ** places;
const DAY_MS = 24 * 60 * 60 * 1000;
const logger = new Logger('createTimeTrackingPayout');

/** Quem recebe e não é quem paga: avisa-se para confirmar que recebeu (`member_paid`). */
export type PayoutNotifier = (payoutId: string) => Promise<unknown>;

/**
 * A empresa paga a quem fez as horas (ver o DTO): o que ainda não lhe foi pago dos registos
 * escolhidos, ou das horas dela entre as datas, ao preço dela ou pelo valor das horas. Com
 * `fromBankAccountId` grava o pagamento na empresa (ao membro, ou ao sócio se for o dono). Se
 * quem recebe é quem paga, o ganho pessoal entra já (da fonte da empresa); senão a pessoa
 * recebe um aviso e confirma.
 */
export async function createTimeTrackingPayout(
  userId: string,
  companyId: string,
  dto: CreateTimeTrackingPayoutDto,
  repository: PrismaTimeTrackingRepository,
  companyRepository: PrismaCompanyRepository,
  payments: SettlementPayments,
  notify: PayoutNotifier,
) {
  await assertTimesheetAccess(userId, companyId, companyRepository, true);
  const timeZone = resolveTimezone(dto.tz);

  // Os registos escolhidos dizem de quem são; o resto lê-se outra vez dentro do cadeado
  let personId = dto.personId;
  if (dto.entryIds) {
    const chosen = await repository.findEntriesByIds(companyId, dto.entryIds);
    const people = new Set(chosen.map((entry) => entry.personId));
    if (people.size !== 1 || !chosen[0]?.personId)
      throw new BadRequestException('Os registos escolhidos têm de ser todos da mesma pessoa');
    personId = chosen[0].personId;
  } else if (dto.fromDate! > dto.toDate!) throw new BadRequestException('A data de início é depois da de fim');

  const person = await repository.findPersonForPayout(companyId, personId!);
  if (!person) throw new NotFoundException('Pessoa não encontrada');
  const targetUserId = person.userId ?? person.member?.userId ?? null;
  const company = person.connection.company;
  const toOwner = !person.member && targetUserId === company.createdById;
  if (dto.fromBankAccountId && !person.member && !toOwner)
    throw new BadRequestException('Liga esta pessoa a um membro (ou ao dono) para gravar o pagamento na empresa');

  // A leitura do que falta pagar e as alocações numa transação com o cadeado da pessoa: dois
  // pedidos ao mesmo tempo (um clique duplo) não lhe pagam as mesmas horas duas vezes
  const created = await repository.locked(`payout:${person.id}`, async (tx) => {
    let entries;
    if (dto.entryIds) {
      entries = await tx.findEntriesByIds(companyId, dto.entryIds);
      if (entries.some((entry) => entry.personId !== person.id))
        throw new BadRequestException('Os registos escolhidos têm de ser todos da mesma pessoa');
    } else {
      const from = new Date(new Date(`${dto.fromDate}T00:00:00Z`).getTime() - DAY_MS);
      const to = new Date(new Date(`${dto.toDate}T00:00:00Z`).getTime() + 2 * DAY_MS);
      entries = (await tx.findPersonEntries(person.id, from, to)).filter((entry) => {
        const day = localDay(entry.start, timeZone);
        return day >= dto.fromDate! && day <= dto.toDate!;
      });
    }

    const open = entries
      .map((entry) => ({ entry, value: entryPayValue(entry) }))
      .filter(({ value }) => value.unpaidSeconds > 0);
    const seconds = open.reduce((sum, { value }) => sum + value.unpaidSeconds, 0);
    if (seconds <= 0) throw new BadRequestException('Não há horas por pagar a esta pessoa nesses registos ou datas');
    const gross = round(dto.amount ?? open.reduce((sum, { value }) => sum + value.unpaidAmount, 0));
    const withholdingPct =
      dto.withholdingPct !== undefined
        ? dto.withholdingPct
        : person.payWithholdingPct === null
          ? null
          : Number(person.payWithholdingPct);
    const net = round(gross * (1 - (withholdingPct ?? 0) / 100));

    const payout = await tx.createPayout(
      {
        companyId,
        personId: person.id,
        memberId: person.member?.id ?? null,
        userId: targetUserId,
        seconds,
        hourlyRate: round(gross / (seconds / 3600), 4),
        grossAmount: gross,
        withholdingPct,
        netAmount: net,
        currencyId: person.connection.currencyId,
        paidAt: new Date(`${dto.paidAt}T00:00:00Z`),
        note: dto.note?.trim() || null,
        createdById: userId,
      },
      open.map(({ entry, value }) => ({ entryId: entry.id, seconds: value.unpaidSeconds })),
    );
    return { id: payout.id, seconds, gross, net, withholdingPct };
  });

  // O pagamento na empresa (outra transação, com as permissões dele) e o ganho de quem paga a si
  // próprio: se algum falhar, desfaz-se tudo o que já se gravou — o pagamento das horas, o ganho e
  // o pagamento na empresa
  let companyPaymentId: string | null = null;
  let incomeId: string | null = null;
  try {
    if (dto.fromBankAccountId) {
      const payment = await payments.create(
        userId,
        companyId,
        {
          paymentType: 'pay',
          partyType: person.member ? 'member' : 'shareholder',
          ...(person.member ? { memberId: person.member.id } : {}),
          fromBankAccountId: dto.fromBankAccountId,
          amount: created.net,
          currencyId: person.connection.currencyId,
          paymentDate: dto.paidAt,
          status: 'completed',
          description: `${payoutIncomeDescription(created.seconds)} · ${person.name}`,
        },
        // O aviso à pessoa vai pelo pagamento das horas, não pelo do membro
        { skipMemberHook: true },
      );
      companyPaymentId = payment.id;
      await repository.setPayoutPayment(created.id, payment.id);
    }

    if (targetUserId && targetUserId === userId) {
      // Quem recebe é quem paga: o ganho entra já, da fonte da empresa
      const income = await repository.createPersonalIncome(
        {
          userId,
          kind: 'freelance',
          description: payoutIncomeDescription(created.seconds),
          grossAmount: created.gross,
          amount: created.net,
          withholdingPct: created.withholdingPct,
          currencyId: person.connection.currencyId,
          date: new Date(`${dto.paidAt}T00:00:00Z`),
          status: 'received',
        },
        company,
      );
      incomeId = income.id;
      await repository.linkPayoutIncome(created.id, income.id);
    }
  } catch (error) {
    const undo = (what: string, run: () => Promise<unknown>) =>
      run().catch((cause) => logger.error(`${what} por desfazer: ${(cause as Error).message}`));
    await undo(`Pagamento das horas ${created.id}`, () => repository.deletePayout(created.id));
    if (incomeId) {
      const id = incomeId;
      await undo(`Ganho ${id}`, () => repository.deletePersonalIncome(id));
    }
    if (companyPaymentId) {
      const id = companyPaymentId;
      await undo(`Pagamento ${id}`, () => payments.remove(userId, companyId, id));
    }
    throw error;
  }

  // O aviso a quem recebe não desfaz nada: o pagamento está feito (fica no registo se falhar)
  if (targetUserId && targetUserId !== userId)
    await notify(created.id).catch((cause) =>
      logger.warn(`Aviso do pagamento das horas ${created.id} por enviar: ${(cause as Error).message}`),
    );

  return payoutView((await repository.findPayoutView(created.id))!);
}

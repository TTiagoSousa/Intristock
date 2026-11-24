import { BadRequestException, NotFoundException } from '@nestjs/common';
import { PrismaCompanyRepository } from 'src/company/repositories/prisma/prisma-company-repository';
import { PrismaCompanyMemberRepository } from '../repositories/prisma/prisma-company-member-repository';
import {
  CreateMemberPayDto,
  MemberPayKind,
  UpdateMemberPayDto,
} from '../dto/member-pay.dto';
import { assertMemberAccess } from './assertMemberAccess';
import { buildMemberPayData } from './buildMemberPayData';
import { memberPayTermsChanged } from './memberPayTermsChanged';
import { CompanyMemberPay } from 'src/generated/prisma/client/client';
import { MemberPayData } from '../repositories/company-member-repository';

const DAY_MS = 24 * 60 * 60 * 1000;

/** O primeiro dia (UTC) do mês a seguir a um YYYY-MM. */
const monthAfter = (month: string) => {
  const [y, m] = month.split('-').map(Number);
  return new Date(Date.UTC(y, m, 1));
};

/**
 * Mudar um salário já aceite de um membro com conta: o aceite continua a valer como está e a mudança vai como uma
 * proposta nova que o substitui (`replacesId`); aceite, o antigo fecha na véspera do início dela. A nova começa
 * depois do último mês já pago do antigo (os pagamentos feitos ficam com ele e não se pagam outra vez). Se já há uma
 * mudança por responder, é essa que se atualiza.
 */
async function proposeSalaryChange(
  userId: string,
  memberId: string,
  current: CompanyMemberPay,
  data: MemberPayData,
  memberRepository: PrismaCompanyMemberRepository,
) {
  const lastPaid = await memberRepository.findLastPaidPeriod(current.id);
  const firstFree = lastPaid ? monthAfter(lastPaid) : null;
  let startDate = data.startDate ?? current.startDate!;
  if (firstFree && startDate < firstFree) startDate = firstFree;
  const endDate = data.endDate !== undefined ? data.endDate : current.endDate;
  if (endDate && endDate < startDate) {
    throw new BadRequestException(
      `Este salário já está pago até ${lastPaid}: a mudança só pode começar em ${startDate.toISOString().slice(0, 7)}`,
    );
  }

  const proposed: MemberPayData = {
    contractId: current.contractId,
    description: current.description,
    grossAmount: Number(current.grossAmount),
    withholdingPct: current.withholdingPct === null ? null : Number(current.withholdingPct),
    payDay: current.payDay,
    paymentsPerYear: current.paymentsPerYear,
    ...data,
    startDate,
    endDate: endDate ?? null,
    status: 'proposed',
    proposedById: userId,
    replacesId: current.id,
  };
  const pending = await memberRepository.findPendingReplacement(current.id);
  if (pending) return memberRepository.updatePay(pending.id, { ...proposed, respondedAt: null, responseNote: null });
  return memberRepository.createPay(memberId, 'salary', proposed);
}

/**
 * Cria (sem `payId`) ou edita um salário ou recibo verde de um membro. O
 * contrato, se vier, tem de ser do mesmo membro.
 *
 * A um membro com conta vai como proposta (`proposed`) e só conta depois de aceite; o salário
 * que substitui (`replacesId`) continua até lá. Responde o membro — ou, quando é o próprio
 * membro (quem gere os salários) a gravar o seu, o dono da empresa. Só o dono a pagar-se a si
 * próprio conta logo.
 *
 * Num salário já aceite, mudar o que se paga (o valor, as vezes por ano, o dia, as datas, a
 * retenção) volta a pedir o acordo: passa outra vez a proposta. Uma recusada que se muda também.
 */
export async function saveMemberPay(
  userId: string,
  companyId: string,
  memberId: string,
  payId: string | null,
  dto: CreateMemberPayDto | UpdateMemberPayDto,
  companyRepository: PrismaCompanyRepository,
  memberRepository: PrismaCompanyMemberRepository,
) {
  const { company, member } = await assertMemberAccess(
    userId,
    companyId,
    memberId,
    'salaries.manage',
    companyRepository,
    memberRepository,
  );

  if (
    dto.contractId &&
    !(await memberRepository.findContract(memberId, dto.contractId))
  ) {
    throw new NotFoundException('Contrato não encontrado');
  }

  // Sem conta é só um registo: conta logo. Com conta, só o dono a gravar o próprio salário
  // dispensa o acordo de alguém.
  const proposal = Boolean(
    member.userId && !(member.userId === userId && company.createdById === userId),
  );

  if (!payId) {
    const create = dto as CreateMemberPayDto;
    const kind = create.kind;
    const replaces = create.replacesId ? await memberRepository.findPay(memberId, create.replacesId) : null;
    if (create.replacesId && (!replaces || replaces.kind !== 'salary' || kind !== 'salary'))
      throw new BadRequestException('Só um salário substitui outro salário do mesmo membro');
    const data = buildMemberPayData(kind, dto);
    // Sem proposta, a mudança vale já: o antigo fecha na véspera (na mesma transação)
    const closeAt = !proposal && replaces && data.startDate ? new Date(data.startDate.getTime() - DAY_MS) : null;
    return memberRepository.createPayReplacing(
      memberId,
      kind,
      {
        ...data,
        status: proposal ? 'proposed' : 'accepted',
        proposedById: proposal ? userId : null,
        replacesId: replaces?.id ?? null,
      },
      closeAt && replaces && (!replaces.endDate || replaces.endDate > closeAt)
        ? { id: replaces.id, endDate: closeAt }
        : null,
    );
  }

  const current = await memberRepository.findPay(memberId, payId);
  if (!current)
    throw new NotFoundException('Salário ou recibo verde não encontrado');
  if (current.status === 'cancelled')
    throw new BadRequestException('Este salário foi cancelado');

  const data = buildMemberPayData(current.kind as MemberPayKind, dto, current);
  const changedAccepted = proposal && current.status === 'accepted' && memberPayTermsChanged(current, data);

  if (changedAccepted && current.kind === 'salary') {
    return proposeSalaryChange(userId, memberId, current, data, memberRepository);
  }
  if (changedAccepted && (current._count.payments > 0 || (await memberRepository.countPayIncomes(current.id)) > 0)) {
    // Um recibo verde já pago: mudar o que se pagou não faz sentido (e, recusado, ficava preso)
    throw new BadRequestException('Este recibo verde já foi pago: os termos já não se mudam');
  }

  const repropose =
    proposal &&
    (current.status === 'proposed' || current.status === 'declined' || changedAccepted);

  return memberRepository.updatePay(payId, {
    ...data,
    ...(repropose
      ? { status: 'proposed', proposedById: userId, respondedAt: null, responseNote: null }
      : {}),
  });
}

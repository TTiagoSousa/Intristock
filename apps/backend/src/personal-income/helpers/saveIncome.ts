import {
  BadRequestException,
  ConflictException,
  NotFoundException,
} from '@nestjs/common';
import { PrismaPersonalIncomeRepository } from '../repositories/prisma/prisma-personal-income-repository';
import { IncomeData } from '../repositories/personal-income-repository';
import {
  CreatePersonalIncomeDto,
  UpdatePersonalIncomeDto,
} from '../dto/personal-income.dto';

// O tipo de ganho que uma fonte dá por omissão
const KIND_OF_SOURCE: Record<string, string> = {
  employer: 'salary',
  client: 'freelance',
  lottery: 'lottery',
  other: 'other',
};

/**
 * Cria (sem `incomeId`) ou edita um ganho. Ao criar, o ganho é solto, de uma
 * fonte, ou de um salário esperado — de uma fonte com salário (`sourceId` +
 * `period`) ou de uma empresa da base que paga a esta pessoa (`memberPayId` +
 * `period`; o tipo vem do salário). Cada período só se regista uma vez. A
 * conta tem de ser da pessoa.
 */
export async function saveIncome(
  userId: string,
  incomeId: string | null,
  dto: CreatePersonalIncomeDto | UpdatePersonalIncomeDto,
  repository: PrismaPersonalIncomeRepository,
) {
  if (dto.currencyId && !(await repository.findCurrency(dto.currencyId)))
    throw new NotFoundException('Moeda não encontrada');
  if (
    dto.bankAccountId &&
    !(await repository.findUserBankAccount(userId, dto.bankAccountId))
  )
    throw new NotFoundException('Conta bancária não encontrada');

  const data: IncomeData = {
    description:
      dto.description === undefined
        ? undefined
        : dto.description?.trim() || null,
    grossAmount: dto.grossAmount,
    amount: dto.amount,
    withholdingPct: dto.withholdingPct,
    currencyId: dto.currencyId,
    date: dto.date ? new Date(dto.date) : undefined,
    status: dto.status,
    bankAccountId: dto.bankAccountId,
  };

  if (incomeId) {
    const current = await repository.findIncome(userId, incomeId);
    if (!current) throw new NotFoundException('Ganho não encontrado');
    return repository.updateIncome(incomeId, data);
  }

  const create = dto as CreatePersonalIncomeDto;
  if (create.memberPayId && create.sourceId)
    throw new BadRequestException(
      'Um ganho vem de uma fonte ou de uma empresa, não dos dois',
    );

  if (create.memberPayId) {
    const pay = await repository.findUserMemberPay(userId, create.memberPayId);
    if (!pay) throw new NotFoundException('Salário não encontrado');
    if (!create.period)
      throw new BadRequestException('Diz que período do salário recebeste');
    if ((pay.kind === 'freelance') !== (create.period === 'once'))
      throw new BadRequestException('Período inválido para este pagamento');
    data.memberPayId = pay.id;
    data.period = create.period;
    data.kind = pay.kind === 'freelance' ? 'freelance' : 'salary';
  } else if (create.sourceId) {
    const source = await repository.findSource(userId, create.sourceId);
    if (!source) throw new NotFoundException('Fonte de ganhos não encontrada');
    if (create.period) {
      if (create.period === 'once' || !source.payDay)
        throw new BadRequestException('Esta fonte não tem salário fixo');
      data.period = create.period;
    }
    data.sourceId = source.id;
    data.kind = create.kind ?? KIND_OF_SOURCE[source.kind] ?? 'other';
  } else {
    if (create.period)
      throw new BadRequestException('Um ganho solto não tem período');
    data.kind = create.kind ?? 'other';
  }

  const key = `${data.memberPayId ?? data.sourceId}|${data.period}`;
  if (data.period && (await repository.findRecordedPeriods(userId)).has(key))
    throw new ConflictException('Esse período já está registado');

  return repository.createIncome(userId, data);
}

import { BadRequestException, NotFoundException } from '@nestjs/common';
import { PrismaCompanyRepository } from 'src/company/repositories/prisma/prisma-company-repository';
import { PrismaTimeTrackingRepository } from '../repositories/prisma/prisma-time-tracking-repository';
import { UpdateTimeTrackingPersonDto } from '../dto/time-tracking.dto';
import { assertTimesheetAccess } from './assertTimesheetAccess';

/**
 * A quem vão as horas de uma pessoa da app: um membro da empresa (os ganhos pessoais vão
 * para a conta dele, se tiver), o dono da empresa (`owner`, que não é membro) ou ninguém; e o
 * que a empresa lhe paga por hora (`payRate`, vazio = o valor das horas) e a retenção disso.
 */
export async function updateTimeTrackingPerson(
  userId: string,
  companyId: string,
  personId: string,
  dto: UpdateTimeTrackingPersonDto,
  repository: PrismaTimeTrackingRepository,
  companyRepository: PrismaCompanyRepository,
) {
  const company = await assertTimesheetAccess(userId, companyId, companyRepository, true);
  if (!(await repository.findPerson(companyId, personId))) throw new NotFoundException('Pessoa não encontrada');
  if (dto.owner && dto.memberId) throw new BadRequestException('Escolhe um membro ou o dono, não os dois');

  // O que a empresa lhe paga (só o que vier)
  const pay = {
    ...(dto.payRate !== undefined ? { payRate: dto.payRate } : {}),
    ...(dto.payWithholdingPct !== undefined ? { payWithholdingPct: dto.payWithholdingPct } : {}),
  };
  // Só se mexe na ligação quando ela vem no pedido
  const linking = dto.owner !== undefined || dto.memberId !== undefined;
  if (!linking) {
    await repository.updatePerson(personId, pay);
    return { updated: true };
  }

  if (dto.owner) {
    await repository.updatePerson(personId, { ...pay, memberId: null, userId: company.createdById });
    return { updated: true };
  }
  if (dto.memberId) {
    const member = await repository.findMember(companyId, dto.memberId);
    if (!member) throw new BadRequestException('Esse membro não é desta empresa');
    await repository.updatePerson(personId, { ...pay, memberId: member.id, userId: member.userId });
    return { updated: true };
  }
  await repository.updatePerson(personId, { ...pay, memberId: null, userId: null });
  return { updated: true };
}

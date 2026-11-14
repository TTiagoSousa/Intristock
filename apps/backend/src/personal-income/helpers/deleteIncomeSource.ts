import { ConflictException, NotFoundException } from '@nestjs/common';
import { PrismaPersonalIncomeRepository } from '../repositories/prisma/prisma-personal-income-repository';

// Uma fonte com ganhos não se apaga: desativa-se, e os ganhos ficam com ela
export async function deleteIncomeSource(
  userId: string,
  sourceId: string,
  repository: PrismaPersonalIncomeRepository,
) {
  const source = await repository.findSource(userId, sourceId);
  if (!source) throw new NotFoundException('Fonte de ganhos não encontrada');
  if (source._count.incomes > 0)
    throw new ConflictException(
      'Esta fonte tem ganhos registados: desativa-a em vez de a apagar',
    );
  await repository.deleteSource(sourceId);
}

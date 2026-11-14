import { NotFoundException } from '@nestjs/common';
import { PrismaLiveTestRepository } from '../repositories/prisma/prisma-live-test-repository';

// Cada utilizador só vê os seus testes ao vivo
export async function findLiveTest(
  userId: string,
  id: string,
  repository: PrismaLiveTestRepository,
) {
  const test = await repository.findOne(id, userId);
  if (!test) throw new NotFoundException('Teste ao vivo não encontrado');
  return test;
}

import { BadRequestException, ConflictException } from '@nestjs/common';
import { PrismaUserRepository } from '../repositories/prisma/prisma-user-repository';
import { assertKeepsAnAdmin, findManagedUser } from './manageUser';

/**
 * Apaga a conta e o que é só dela (simulações, testes ao vivo, calculadoras,
 * avisos). As empresas e as contas bancárias que criou são dados partilhados: com
 * elas não se apaga, desativa-se ou bloqueia-se. Nem com uma simulação ou um teste
 * ao vivo a correr, que o simulador ainda está a gravar.
 */
export async function deleteManagedUser(
  adminId: string,
  id: string,
  userRepository: PrismaUserRepository,
) {
  if (id === adminId)
    throw new BadRequestException('Não podes apagar a tua conta');

  const user = await findManagedUser(id, userRepository);
  await assertKeepsAnAdmin(user, userRepository);

  const usage = await userRepository.countOwnedData(id);
  if (usage.companies > 0 || usage.bankAccounts > 0) {
    throw new ConflictException(
      'Este utilizador criou empresas ou contas bancárias: desativa ou bloqueia a conta em vez de a apagar',
    );
  }
  if (usage.running > 0) {
    throw new ConflictException(
      'Este utilizador tem simulações ou testes ao vivo a correr: espera que acabem ou para-os primeiro',
    );
  }

  await userRepository.delete(id);
  return { id };
}

import { BadRequestException } from '@nestjs/common';
import { PrismaUserRepository } from '../repositories/prisma/prisma-user-repository';
import { BlockUserDto } from '../dto/block-user.dto';
import { assertKeepsAnAdmin, findManagedUser } from './manageUser';

// Mais do que isto é desativar a conta
const MAX_BLOCK_MS = 5 * 365 * 24 * 60 * 60 * 1000;

/**
 * Bloqueia a conta até uma data: não entra e a sessão aberta deixa de servir (a
 * estratégia JWT lê o bloqueio a cada pedido). Acaba sozinho nessa data.
 */
export async function blockUser(
  adminId: string,
  id: string,
  dto: BlockUserDto,
  userRepository: PrismaUserRepository,
) {
  if (id === adminId)
    throw new BadRequestException('Não podes bloquear a tua conta');

  const until = new Date(dto.until).getTime();
  if (until <= Date.now())
    throw new BadRequestException('A data do fim do bloqueio já passou');
  if (until - Date.now() > MAX_BLOCK_MS) {
    throw new BadRequestException('Para mais de 5 anos, desativa a conta');
  }

  const user = await findManagedUser(id, userRepository);
  await assertKeepsAnAdmin(user, userRepository);

  return userRepository.update(id, {
    blockedUntil: new Date(until),
    blockedReason: dto.reason?.trim() || null,
  });
}

export async function unblockUser(
  id: string,
  userRepository: PrismaUserRepository,
) {
  await findManagedUser(id, userRepository);
  return userRepository.update(id, { blockedUntil: null, blockedReason: null });
}

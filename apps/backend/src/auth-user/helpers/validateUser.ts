import { BadRequestException, ForbiddenException } from '@nestjs/common';
import { PrismaUserRepository } from 'src/user/repositories/prisma/prisma-user-repository';
import { comparePasswords, DUMMY_PASSWORD_HASH } from 'src/utils/password/compare.passwords';

export async function validateUser(
  email: string,
  password: string,
  userRepository: PrismaUserRepository,
) {
  // Sem validar o formato do email: a conta criada na instalação entra como
  // "admin", sem domínio
  const user = await userRepository.findByEmail(email.trim().toLowerCase());

  // Corre sempre o bcrypt, também sem conta (com um hash fixo), para o tempo de
  // resposta ser o mesmo e não denunciar que contas existem
  const isMatch = await comparePasswords({
    password,
    hash: user?.hashedPassword ?? DUMMY_PASSWORD_HASH,
  });

  if (!user || !isMatch) {
    throw new BadRequestException('Credenciais inválidas');
  }

  if (!user.active) {
    throw new BadRequestException('Esta conta está desativada. Fala com o administrador.');
  }

  // O ecrã escreve a data na hora de quem tenta entrar
  if (user.blockedUntil && user.blockedUntil > new Date()) {
    throw new ForbiddenException({
      message: 'Esta conta está bloqueada. Fala com o administrador.',
      blockedUntil: user.blockedUntil.toISOString(),
      blockedReason: user.blockedReason,
    });
  }

  const { hashedPassword: _, ...result } = user;
  return result;
}

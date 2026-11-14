import { BadRequestException, NotFoundException } from '@nestjs/common';
import { PrismaUserRepository } from '../repositories/prisma/prisma-user-repository';

export async function findManagedUser(
  id: string,
  userRepository: PrismaUserRepository,
) {
  const user = await userRepository.findById(id);
  if (!user) throw new NotFoundException('Utilizador não encontrado');
  return user;
}

/// Antes de tirar a um admin o papel ou o acesso: tem de ficar outro que possa entrar
export async function assertKeepsAnAdmin(
  target: { id: string; role: string },
  userRepository: PrismaUserRepository,
) {
  if (target.role !== 'ADMIN') return;
  if ((await userRepository.countUsableAdmins(target.id)) === 0) {
    throw new BadRequestException(
      'Tem de ficar pelo menos um administrador ativo',
    );
  }
}

/// O nome completo, o primeiro nome e o resto, como a conta os guarda
export function splitFullName(fullName: string) {
  const name = fullName.trim();
  const spaceIndex = name.indexOf(' ');
  return {
    fullName: name,
    firstName: spaceIndex > 0 ? name.slice(0, spaceIndex) : name,
    lastName: spaceIndex > 0 ? name.slice(spaceIndex + 1).trim() : '',
  };
}

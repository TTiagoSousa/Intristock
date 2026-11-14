import { ConflictException } from '@nestjs/common';
import * as bcrypt from 'bcrypt';
import { PrismaUserRepository } from '../repositories/prisma/prisma-user-repository';
import { CreateManagedUserDto } from '../dto/create-managed-user.dto';
import { splitFullName } from './manageUser';

export async function createManagedUser(
  dto: CreateManagedUserDto,
  userRepository: PrismaUserRepository,
) {
  const email = dto.email.trim().toLowerCase();
  const emailExists = await userRepository.findByEmail(email);
  if (emailExists) throw new ConflictException('Já existe uma conta com esse email');


  // Criada pelo admin, a conta nasce ativa — não há email de ativação numa
  // instalação self-host
  const { hashedPassword: _, ...user } = await userRepository.create({
    email,
    ...splitFullName(dto.fullName),
    hashedPassword: await bcrypt.hash(dto.password, 12),
    role: dto.role ?? 'USER',
    active: true,
  });
  return user;
}

import { BadRequestException, NotFoundException } from '@nestjs/common';
import * as bcrypt from 'bcrypt';
import { PrismaUserRepository } from '../repositories/prisma/prisma-user-repository';
import { ChangePasswordDto } from '../dto/change-password.dto';

export async function changeOwnPassword(
  userId: string,
  dto: ChangePasswordDto,
  userRepository: PrismaUserRepository,
) {
  const hashedPassword = await userRepository.findPasswordHash(userId);
  if (!hashedPassword) throw new NotFoundException('Utilizador não encontrado');

  // Pede a password atual: uma sessão esquecida aberta não chega para tomar a conta
  const matches = await bcrypt.compare(dto.currentPassword, hashedPassword);
  if (!matches) throw new BadRequestException('A password atual não está certa');

  if (dto.currentPassword === dto.newPassword) {
    throw new BadRequestException('A password nova tem de ser diferente da atual');
  }

  await userRepository.updatePassword(userId, await bcrypt.hash(dto.newPassword, 12));
  return { message: 'Password alterada' };
}

import { BadRequestException, ConflictException } from '@nestjs/common';
import * as bcrypt from 'bcrypt';
import { PrismaUserRepository } from '../repositories/prisma/prisma-user-repository';
import { UserUpdate } from '../repositories/user-repository';
import { UpdateManagedUserDto } from '../dto/update-managed-user.dto';
import {
  assertKeepsAnAdmin,
  findManagedUser,
  splitFullName,
} from './manageUser';

export async function updateManagedUser(
  adminId: string,
  id: string,
  dto: UpdateManagedUserDto,
  userRepository: PrismaUserRepository,
) {
  const user = await findManagedUser(id, userRepository);

  const losesRole =
    user.role === 'ADMIN' && dto.role !== undefined && dto.role !== 'ADMIN';
  const losesAccess = user.active && dto.active === false;
  // O admin não se tira o papel nem se desativa: ficava de fora a meio
  if (id === adminId && (losesRole || losesAccess)) {
    throw new BadRequestException(
      'Não podes tirar o teu papel nem desativar a tua conta',
    );
  }
  if (losesRole || losesAccess) await assertKeepsAnAdmin(user, userRepository);

  const data: UserUpdate = {};
  if (dto.email !== undefined) {
    const email = dto.email.trim().toLowerCase();
    if (email !== user.email) {
      if (await userRepository.findByEmail(email)) {
        throw new ConflictException('Já existe uma conta com esse email');
      }
      data.email = email;
    }
  }
  if (dto.fullName !== undefined)
    Object.assign(data, splitFullName(dto.fullName));
  if (dto.role !== undefined) data.role = dto.role;
  if (dto.active !== undefined) data.active = dto.active;
  if (dto.password) data.hashedPassword = await bcrypt.hash(dto.password, 12);

  return userRepository.update(id, data);
}

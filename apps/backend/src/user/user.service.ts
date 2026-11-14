import { Injectable } from '@nestjs/common';
import { PrismaUserRepository } from './repositories/prisma/prisma-user-repository';
import { createManagedUser } from './helpers/createManagedUser';
import { changeOwnPassword } from './helpers/changeOwnPassword';
import { findAllUsers } from './helpers/findAllUsers';
import { findCurrentUser } from './helpers/findCurrentUser';
import { CreateManagedUserDto } from './dto/create-managed-user.dto';
import { ChangePasswordDto } from './dto/change-password.dto';
import { UpdateManagedUserDto } from './dto/update-managed-user.dto';
import { BlockUserDto } from './dto/block-user.dto';
import { updateManagedUser } from './helpers/updateManagedUser';
import { deleteManagedUser } from './helpers/deleteManagedUser';
import { blockUser, unblockUser } from './helpers/blockUser';

@Injectable()
export class UserService {
  constructor(private readonly userRepository: PrismaUserRepository) {}

  async create(dto: CreateManagedUserDto) {
    return createManagedUser(dto, this.userRepository);
  }

  async update(adminId: string, id: string, dto: UpdateManagedUserDto) {
    return updateManagedUser(adminId, id, dto, this.userRepository);
  }

  async remove(adminId: string, id: string) {
    return deleteManagedUser(adminId, id, this.userRepository);
  }

  async block(adminId: string, id: string, dto: BlockUserDto) {
    return blockUser(adminId, id, dto, this.userRepository);
  }

  async unblock(id: string) {
    return unblockUser(id, this.userRepository);
  }

  async findAll() {
    return findAllUsers(this.userRepository);
  }

  async findCurrent(id: string) {
    return findCurrentUser(id, this.userRepository);
  }

  async changePassword(id: string, dto: ChangePasswordDto) {
    return changeOwnPassword(id, dto, this.userRepository);
  }
}

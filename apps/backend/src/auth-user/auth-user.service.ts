import { Injectable } from '@nestjs/common';
import { JwtService } from '@nestjs/jwt';
import { PrismaUserRepository } from 'src/user/repositories/prisma/prisma-user-repository';
import { validateUser } from './helpers/validateUser';
import { loginUser } from './helpers/loginUser';

@Injectable()
export class AuthUserService {
  constructor(
    private readonly userRepository: PrismaUserRepository,
    private readonly jwt: JwtService,
  ) {}

  async validateUser(email: string, password: string) {
    return validateUser(email, password, this.userRepository);
  }

  async login(user: { id: string; email: string; fullName: string }) {
    return loginUser(user, this.jwt);
  }
}

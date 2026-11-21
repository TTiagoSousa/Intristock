import { Injectable } from '@nestjs/common';
import { JwtService } from '@nestjs/jwt';
import type { Request, Response } from 'express';
import { PrismaUserRepository } from 'src/user/repositories/prisma/prisma-user-repository';
import { validateUser } from './helpers/validateUser';
import { issueUserSession } from './helpers/issueUserSession';

@Injectable()
export class AuthUserService {
  constructor(
    private readonly userRepository: PrismaUserRepository,
    private readonly jwt: JwtService,
  ) {}

  async validateUser(email: string, password: string) {
    return validateUser(email, password, this.userRepository);
  }

  login(
    req: Request,
    res: Response,
    user: { id: string; email: string; fullName: string },
    remember: boolean,
  ) {
    issueUserSession(req, res, user, remember, this.jwt);
  }
}

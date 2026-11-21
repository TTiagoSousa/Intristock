import { Module } from '@nestjs/common';
import { UserService } from './user.service';
import { UserController } from './user.controller';
import { PrismaUserRepository } from './repositories/prisma/prisma-user-repository';
import { UserJwtModule } from 'src/auth-user/user-jwt.module';

@Module({
  imports: [UserJwtModule],
  controllers: [UserController],
  providers: [
    UserService,
    {
      provide: PrismaUserRepository,
      useClass: PrismaUserRepository,
    },
  ],
  exports: [PrismaUserRepository],
})
export class UserModule {}

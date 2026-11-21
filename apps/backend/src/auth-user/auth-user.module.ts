import { Module } from '@nestjs/common';
import { PassportModule } from '@nestjs/passport';
import { AuthUserService } from './auth-user.service';
import { AuthUserController } from './auth-user.controller';
import { JwtUserStrategy } from './strategies/jwt-user.strategy';
import { LocalUserStrategy } from './strategies/local-user.strategy';
import { UserModule } from 'src/user/user.module';
import { UserJwtModule } from './user-jwt.module';

@Module({
  imports: [
    UserModule,
    PassportModule,
    UserJwtModule,
  ],
  controllers: [AuthUserController],
  providers: [AuthUserService, JwtUserStrategy, LocalUserStrategy],
})
export class AuthUserModule {}

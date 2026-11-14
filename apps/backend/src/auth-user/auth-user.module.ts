import { Module } from '@nestjs/common';
import { JwtModule } from '@nestjs/jwt';
import { PassportModule } from '@nestjs/passport';
import { ConfigModule, ConfigService } from '@nestjs/config';
import { AuthUserService } from './auth-user.service';
import { AuthUserController } from './auth-user.controller';
import { JwtUserStrategy } from './strategies/jwt-user.strategy';
import { LocalUserStrategy } from './strategies/local-user.strategy';
import { UserModule } from 'src/user/user.module';

@Module({
  imports: [
    UserModule,
    PassportModule,
    JwtModule.registerAsync({
      imports: [ConfigModule],
      inject: [ConfigService],
      useFactory: (config: ConfigService) => ({
        secret: config.get<string>('JWT_USER_SECRET'),
        signOptions: { expiresIn: '7d' },
      }),
    }),
  ],
  controllers: [AuthUserController],
  providers: [AuthUserService, JwtUserStrategy, LocalUserStrategy],
})
export class AuthUserModule {}

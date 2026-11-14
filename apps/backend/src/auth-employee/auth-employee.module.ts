import { Module } from '@nestjs/common';
import { JwtModule } from '@nestjs/jwt';
import { PassportModule } from '@nestjs/passport';
import { ConfigModule, ConfigService } from '@nestjs/config';
import { AuthEmployeeService } from './auth-employee.service';
import { AuthEmployeeController } from './auth-employee.controller';
import { JwtStrategy } from './strategies/jwt.strategy';
import { LocalStrategy } from './strategies/local.strategy';
import { EmployeeModule } from 'src/employee/employee.module';

@Module({
  imports: [
    EmployeeModule,
    PassportModule,
    JwtModule.registerAsync({
      imports: [ConfigModule],
      inject: [ConfigService],
      useFactory: (config: ConfigService) => ({
        secret: config.get<string>('JWT_SECRET'),
        signOptions: { expiresIn: '7d' },
      }),
    }),
  ],
  controllers: [AuthEmployeeController],
  providers: [AuthEmployeeService, JwtStrategy, LocalStrategy],
})
export class AuthEmployeeModule {}

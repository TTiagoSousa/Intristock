import { Injectable, UnauthorizedException } from '@nestjs/common';
import { PassportStrategy } from '@nestjs/passport';
import { Strategy } from 'passport-local';
import { AuthEmployeeService } from '../auth-employee.service';

@Injectable()
export class LocalStrategy extends PassportStrategy(Strategy) {
  constructor(private readonly authService: AuthEmployeeService) {
    super({ usernameField: 'email' });
  }

  async validate(email: string, password: string) {
    const employee = await this.authService.validateEmployee(email, password);
    if (!employee) throw new UnauthorizedException('Credenciais inválidas');
    return employee;
  }
}

import { Injectable, UnauthorizedException } from '@nestjs/common';
import { PassportStrategy } from '@nestjs/passport';
import { Strategy } from 'passport-local';
import { AuthUserService } from '../auth-user.service';

@Injectable()
export class LocalUserStrategy extends PassportStrategy(Strategy, 'local-user') {
  constructor(private readonly authUserService: AuthUserService) {
    super({ usernameField: 'email' });
  }

  async validate(email: string, password: string) {
    const user = await this.authUserService.validateUser(email, password);
    if (!user) throw new UnauthorizedException('Credenciais inválidas');
    return user;
  }
}

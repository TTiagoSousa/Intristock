import { Injectable, UnauthorizedException } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { PassportStrategy } from '@nestjs/passport';
import { ExtractJwt, Strategy } from 'passport-jwt';
import { Request } from 'express';
import { JwtUserPayload } from '../jwt-payload.interface';
import { PrismaService } from 'src/prisma/prisma.service';

@Injectable()
export class JwtUserStrategy extends PassportStrategy(Strategy, 'jwt-user') {
  constructor(
    config: ConfigService,
    private readonly prisma: PrismaService,
  ) {
    super({
      jwtFromRequest: ExtractJwt.fromExtractors([
        (req: Request) => req?.cookies?.user_access_token ?? null,
      ]),
      ignoreExpiration: false,
      secretOrKey: config.get<string>('JWT_USER_SECRET')!,
    });
  }

  // A conta lê-se a cada pedido: desativar ou bloquear corta a sessão aberta logo
  // e mudar a password (a própria ou pelo admin) corta os tokens emitidos antes
  async validate(payload: {
    sub: string;
    email: string;
    fullName: string;
    remember?: boolean;
    iat?: number;
  }): Promise<JwtUserPayload> {
    const user = await this.prisma.user.findUnique({
      where: { id: payload.sub },
      select: { active: true, blockedUntil: true, passwordChangedAt: true },
    });
    if (!user || !user.active || (user.blockedUntil && user.blockedUntil > new Date())) {
      throw new UnauthorizedException();
    }
    // O `iat` é em segundos: um token do mesmo segundo da mudança (o que se emite
    // logo a seguir a ela) continua a valer
    if (
      user.passwordChangedAt &&
      (payload.iat ?? 0) < Math.floor(user.passwordChangedAt.getTime() / 1000)
    ) {
      throw new UnauthorizedException();
    }
    return {
      id: payload.sub,
      email: payload.email,
      fullName: payload.fullName,
      remember: payload.remember === true,
    };
  }
}

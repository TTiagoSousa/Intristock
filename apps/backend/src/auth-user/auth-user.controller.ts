import { Body, Controller, Get, HttpCode, Post, Req, Res, UseGuards } from '@nestjs/common';
import { Request, Response } from 'express';
import { AuthUserService } from './auth-user.service';
import { LocalUserAuthGuard } from './guards/local-user-auth.guard';
import { JwtUserAuthGuard } from './guards/jwt-user-auth.guard';
import { JwtUserPayload } from './jwt-payload.interface';
import { LoginThrottlerGuard } from 'src/common/throttle/login-throttler.guard';
import { USER_SESSION_COOKIE, userSessionCookieOptions } from './session-cookie';

// Sem registo nem recuperação de password: numa instalação self-host as contas
// são criadas pelo admin (POST /user), e quem perder a password pede-lhe outra.
@Controller('auth-user')
export class AuthUserController {
  constructor(private readonly authUserService: AuthUserService) {}

  // O limite de tentativas corre antes do bcrypt (S4)
  @UseGuards(LoginThrottlerGuard, LocalUserAuthGuard)
  @Post('login')
  @HttpCode(200)
  async login(
    @Req() req: Request,
    @Body('rememberMe') rememberMe: boolean,
    @Res({ passthrough: true }) res: Response,
  ) {
    this.authUserService.login(req, res, req.user as any, rememberMe === true);

    return { message: 'Login efetuado com sucesso' };
  }

  @UseGuards(JwtUserAuthGuard)
  @Post('logout')
  @HttpCode(200)
  logout(@Req() req: Request, @Res({ passthrough: true }) res: Response) {
    res.clearCookie(USER_SESSION_COOKIE, userSessionCookieOptions(req));
    return { message: 'Sessão terminada' };
  }

  @UseGuards(JwtUserAuthGuard)
  @Get('me')
  getProfile(@Req() req: Request & { user: JwtUserPayload }) {
    return req.user;
  }
}

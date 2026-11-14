import { Body, Controller, Get, HttpCode, Post, Req, Res, UseGuards } from '@nestjs/common';
import { Request, Response } from 'express';
import { AuthUserService } from './auth-user.service';
import { LocalUserAuthGuard } from './guards/local-user-auth.guard';
import { JwtUserAuthGuard } from './guards/jwt-user-auth.guard';
import { JwtUserPayload } from './jwt-payload.interface';
import { USER_SESSION_COOKIE, USER_SESSION_MAX_AGE_MS, userSessionCookieOptions } from './session-cookie';

// Sem registo nem recuperação de password: numa instalação self-host as contas
// são criadas pelo admin (POST /user), e quem perder a password pede-lhe outra.
@Controller('auth-user')
export class AuthUserController {
  constructor(private readonly authUserService: AuthUserService) {}

  @UseGuards(LocalUserAuthGuard)
  @Post('login')
  @HttpCode(200)
  async login(
    @Req() req: Request,
    @Body('rememberMe') rememberMe: boolean,
    @Res({ passthrough: true }) res: Response,
  ) {
    const token = await this.authUserService.login(req.user as any);

    res.cookie(USER_SESSION_COOKIE, token, {
      ...userSessionCookieOptions(req),
      ...(rememberMe ? { maxAge: USER_SESSION_MAX_AGE_MS } : {}),
    });

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

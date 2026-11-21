import { JwtService } from '@nestjs/jwt';
import type { Request, Response } from 'express';
import { loginUser } from './loginUser';
import { USER_SESSION_COOKIE, USER_SESSION_MAX_AGE_MS, userSessionCookieOptions } from '../session-cookie';

// Emite o token e grava o cookie da sessão (com «lembrar-me», dura 7 dias; sem ele,
// acaba ao fechar o browser)
export function issueUserSession(
  req: Request,
  res: Response,
  user: { id: string; email: string; fullName: string },
  remember: boolean,
  jwtService: JwtService,
) {
  const token = loginUser(user, jwtService, remember);
  res.cookie(USER_SESSION_COOKIE, token, {
    ...userSessionCookieOptions(req),
    ...(remember ? { maxAge: USER_SESSION_MAX_AGE_MS } : {}),
  });
}

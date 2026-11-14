import type { CookieOptions, Request } from 'express';

export const USER_SESSION_COOKIE = 'user_access_token';
export const USER_SESSION_MAX_AGE_MS = 7 * 24 * 60 * 60 * 1000;

/**
 * Opções do cookie de sessão. O `secure` segue o protocolo de cada pedido: a mesma
 * instalação abre-se pelo domínio com SSL (proxy → https) e pelo IP da VM (http).
 * Um cookie `secure` em http nunca chega a ser guardado — o login parecia
 * funcionar e o pedido seguinte dava 401.
 *
 * `req.secure` só reflete o https do proxy porque o main.ts confia no nginx local
 * (`trust proxy`), que passa adiante o X-Forwarded-Proto.
 *
 * O logout tem de usar as mesmas opções, senão o browser não reconhece o cookie
 * a apagar.
 */
export function userSessionCookieOptions(req: Request): CookieOptions {
  return {
    httpOnly: true,
    secure: req.secure,
    sameSite: 'strict',
    path: '/',
  };
}

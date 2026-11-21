import { NextFunction, Request, Response } from 'express';

// O cabeçalho que o frontend põe em todos os pedidos (httpService.ts). Um formulário
// de outro site não o consegue pôr, e um fetch de outra origem com ele precisa do
// preflight do CORS, que só deixa passar o FRONTEND_URL.
export const CSRF_HEADER = 'x-requested-with';

const SAFE_METHODS = new Set(['GET', 'HEAD', 'OPTIONS']);
const ALLOWED_TYPES = new Set(['application/json', 'multipart/form-data']);

function hasBody(req: Request) {
  const length = req.headers['content-length'];
  if (length !== undefined) return Number(length) > 0;
  return req.headers['transfer-encoding'] !== undefined;
}

/**
 * Contra o CSRF a partir de um subdomínio (o `sameSite: strict` do cookie é por site,
 * não por origem): as escritas só passam com corpo em JSON ou multipart (os uploads),
 * os tipos que um formulário HTML não manda sem preflight (o multipart passa nos
 * formulários, mas sem o cabeçalho abaixo não chega). As escritas sem corpo têm de
 * trazer o cabeçalho do frontend.
 */
export function csrfGuardMiddleware(req: Request, res: Response, next: NextFunction) {
  if (SAFE_METHODS.has(req.method)) return next();

  const fromApp = req.headers[CSRF_HEADER] !== undefined;

  if (hasBody(req)) {
    const type = String(req.headers['content-type'] ?? '').split(';')[0].trim().toLowerCase();
    if (!ALLOWED_TYPES.has(type)) {
      res.status(415).json({
        statusCode: 415,
        message: 'O pedido tem de ser em JSON.',
        error: 'Unsupported Media Type',
      });
      return;
    }
    // Um formulário de outro site pode mandar multipart sem preflight
    if (type === 'multipart/form-data' && !fromApp) {
      res.status(403).json({ statusCode: 403, message: 'Pedido recusado.', error: 'Forbidden' });
      return;
    }
    return next();
  }

  if (!fromApp) {
    res.status(403).json({ statusCode: 403, message: 'Pedido recusado.', error: 'Forbidden' });
    return;
  }
  next();
}

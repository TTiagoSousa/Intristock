import { ArgumentsHost, Catch, HttpStatus, Logger } from '@nestjs/common';
import { BaseExceptionFilter } from '@nestjs/core';
import { Response } from 'express';
import { Prisma } from 'src/generated/prisma/client/client';

// Os erros do Prisma que são do pedido (não do servidor) e a resposta de cada um
const KNOWN_ERRORS: Record<string, { status: HttpStatus; message: string; error: string }> = {
  P2002: {
    status: HttpStatus.CONFLICT,
    message: 'Já existe um registo com esses dados.',
    error: 'Conflict',
  },
  P2025: {
    status: HttpStatus.NOT_FOUND,
    message: 'O registo não foi encontrado.',
    error: 'Not Found',
  },
  P2003: {
    status: HttpStatus.CONFLICT,
    message: 'Não é possível: o registo está ligado a outros dados (ou um dos dados ligados não existe).',
    error: 'Conflict',
  },
};

/**
 * Os P2002 (único), P2025 (não encontrado) e P2003 (chave estrangeira) que nenhum
 * helper tratou deixam de chegar como 500. Os outros seguem para o filtro do Nest.
 */
@Catch(Prisma.PrismaClientKnownRequestError)
export class PrismaExceptionFilter extends BaseExceptionFilter {
  private readonly logger = new Logger(PrismaExceptionFilter.name);

  catch(exception: Prisma.PrismaClientKnownRequestError, host: ArgumentsHost) {
    const known = KNOWN_ERRORS[exception.code];
    if (!known || host.getType() !== 'http') return super.catch(exception, host);

    // O detalhe (a tabela, os campos) fica no registo, não vai para o browser
    this.logger.warn(`${exception.code}: ${exception.message.split('\n').pop()}`);

    const res = host.switchToHttp().getResponse<Response>();
    if (res.headersSent) return;
    res.status(known.status).json({
      statusCode: known.status,
      message: known.message,
      error: known.error,
    });
  }
}

import { ArgumentsHost, Logger } from '@nestjs/common';
import { BaseExceptionFilter } from '@nestjs/core';
import { Prisma } from 'src/generated/prisma/client/client';
import { PrismaExceptionFilter } from './prisma-exception.filter';

const prismaError = (code: string) =>
  new Prisma.PrismaClientKnownRequestError(
    'Invalid `prisma.user.create()` invocation:\n\nUnique constraint failed on the fields: (`email`)',
    { code, clientVersion: 'test' },
  );

const httpHost = (headersSent = false) => {
  const res = {
    headersSent,
    status: jest.fn().mockReturnThis(),
    json: jest.fn().mockReturnThis(),
  };
  const host = {
    getType: () => 'http',
    switchToHttp: () => ({ getResponse: () => res }),
  } as unknown as ArgumentsHost;
  return { host, res };
};

describe('PrismaExceptionFilter', () => {
  let parentCatch: jest.SpyInstance;

  beforeEach(() => {
    parentCatch = jest.spyOn(BaseExceptionFilter.prototype, 'catch').mockImplementation(() => undefined);
    jest.spyOn(Logger.prototype, 'warn').mockImplementation(() => undefined);
  });
  afterEach(() => jest.restoreAllMocks());

  it.each([
    ['P2002', 409, 'Conflict', 'Já existe um registo com esses dados.'],
    ['P2025', 404, 'Not Found', 'O registo não foi encontrado.'],
    ['P2003', 409, 'Conflict', expect.stringContaining('ligado a outros dados')],
  ])('%s responde %i sem o detalhe da base', (code, status, error, message) => {
    const { host, res } = httpHost();
    new PrismaExceptionFilter().catch(prismaError(code), host);
    expect(res.status).toHaveBeenCalledWith(status);
    expect(res.json).toHaveBeenCalledWith({ statusCode: status, message, error });
    // a tabela e os campos não vão para o browser
    expect(JSON.stringify(res.json.mock.calls[0][0])).not.toContain('email');
    expect(parentCatch).not.toHaveBeenCalled();
  });

  it('o detalhe fica no registo', () => {
    const warn = jest.spyOn(Logger.prototype, 'warn').mockImplementation(() => undefined);
    new PrismaExceptionFilter().catch(prismaError('P2002'), httpHost().host);
    expect(warn).toHaveBeenCalledWith(expect.stringContaining('P2002: Unique constraint failed'));
  });

  it('os outros códigos seguem para o filtro do Nest', () => {
    const { host, res } = httpHost();
    const error = prismaError('P2034');
    new PrismaExceptionFilter().catch(error, host);
    expect(parentCatch).toHaveBeenCalledWith(error, host);
    expect(res.status).not.toHaveBeenCalled();
  });

  it('fora de HTTP segue para o filtro do Nest', () => {
    const host = { getType: () => 'rpc' } as unknown as ArgumentsHost;
    const error = prismaError('P2002');
    new PrismaExceptionFilter().catch(error, host);
    expect(parentCatch).toHaveBeenCalledWith(error, host);
  });

  it('com a resposta já enviada não escreve outra vez', () => {
    const { host, res } = httpHost(true);
    new PrismaExceptionFilter().catch(prismaError('P2025'), host);
    expect(res.status).not.toHaveBeenCalled();
  });
});

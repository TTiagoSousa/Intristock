import { HttpAdapterHost, NestFactory } from '@nestjs/core';
import { NestExpressApplication } from '@nestjs/platform-express';
import { AppModule } from './app.module';
import { ValidationPipe } from '@nestjs/common';
import cookieParser from 'cookie-parser';
import helmet from 'helmet';
import { PrismaExceptionFilter } from './common/filters/prisma-exception.filter';
import { csrfGuardMiddleware } from './common/middleware/csrf-guard.middleware';
import { assertProductionSecrets } from './common/config/assertProductionSecrets';

async function bootstrap() {
  const app = await NestFactory.create<NestExpressApplication>(AppModule);

  // Em produção não arranca com segredos fracos ou os do .env.example (depois do
  // create: o ConfigModule já leu o .env; os onModuleInit ainda não correram)
  assertProductionSecrets(process.env);

  // Na VM os pedidos chegam pelo nginx local; confiar só nele (loopback) faz o
  // req.secure refletir o https de um proxy à frente, que decide o cookie seguro.
  // Ligações diretas de outros IPs continuam a não poder fingir o protocolo.
  app.set('trust proxy', 'loopback');

  // O CORS primeiro: as respostas recusadas pelos middlewares abaixo também levam
  // os cabeçalhos dele, e o browser mostra a mensagem
  const allowedOrigins = (process.env.FRONTEND_URL ?? '')
    .split(',')
    .map((origin) => origin.trim())
    .filter(Boolean);

  app.enableCors({
    origin: allowedOrigins,
    credentials: true,
  });

  // Os cabeçalhos de segurança (S3c). A API só devolve JSON e ficheiros: a CSP é a
  // mais fechada; o HSTS fica para o nginx, que sabe se há https
  app.use(
    helmet({
      contentSecurityPolicy: { directives: { defaultSrc: ["'none'"], frameAncestors: ["'none'"] } },
      crossOriginResourcePolicy: { policy: 'same-site' },
      strictTransportSecurity: false,
    }),
  );

  app.use(cookieParser());

  // As escritas só em JSON ou multipart, e as sem corpo com o cabeçalho do frontend
  app.use(csrfGuardMiddleware);

  // Os erros do Prisma conhecidos (único, não encontrado, chave estrangeira) → 409/404
  app.useGlobalFilters(new PrismaExceptionFilter(app.get(HttpAdapterHost).httpAdapter));

  app.useGlobalPipes(
    new ValidationPipe({
      transform: true,
      whitelist: true,
    }),
  );

  // O systemd para o serviço com SIGTERM; sem isto o Nest não fecha as ligações
  // ao Postgres
  app.enableShutdownHooks();

  // Na VM o backend só ouve o nginx (HOST=127.0.0.1); em desenvolvimento fica em
  // todas as interfaces
  const port = process.env.PORT ?? 3333;
  const host = process.env.HOST ?? '0.0.0.0';
  await app.listen(port, host);
}

bootstrap();

import { NestFactory } from '@nestjs/core';
import { NestExpressApplication } from '@nestjs/platform-express';
import { AppModule } from './app.module';
import { ValidationPipe } from '@nestjs/common';
import cookieParser from 'cookie-parser';

async function bootstrap() {
  const app = await NestFactory.create<NestExpressApplication>(AppModule);

  // Na VM os pedidos chegam pelo nginx local; confiar só nele (loopback) faz o
  // req.secure refletir o https de um proxy à frente, que decide o cookie seguro.
  // Ligações diretas de outros IPs continuam a não poder fingir o protocolo.
  app.set('trust proxy', 'loopback');

  app.use(cookieParser());

  app.useGlobalPipes(
    new ValidationPipe({
      transform: true,
      whitelist: true,
    }),
  );

  const allowedOrigins = (process.env.FRONTEND_URL ?? '')
    .split(',')
    .map((origin) => origin.trim())
    .filter(Boolean);

  app.enableCors({
    origin: allowedOrigins,
    credentials: true,
  });

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

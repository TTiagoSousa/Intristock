import { Module } from '@nestjs/common';
import { ApiKeyController } from './api-key.controller';
import { ApiKeyService } from './api-key.service';
import { PrismaApiKeyRepository } from './repositories/prisma/prisma-api-key-repository';

@Module({
  controllers: [ApiKeyController],
  providers: [ApiKeyService, { provide: PrismaApiKeyRepository, useClass: PrismaApiKeyRepository }],
  // Os preços das motas (personal-portfolio) correm os pedidos por aqui
  exports: [ApiKeyService],
})
export class ApiKeyModule {}

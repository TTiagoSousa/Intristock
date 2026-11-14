import { Module } from '@nestjs/common';
import { StorageService } from './storage.service';
import { S3StorageProvider } from './providers/s3.provider';

// Sem controller de propósito: nenhum endpoint devolve credenciais nem fala
// diretamente com o bucket — o acesso é sempre por quem é dono do documento.
@Module({
  providers: [StorageService, S3StorageProvider],
  exports: [StorageService],
})
export class StorageModule {}

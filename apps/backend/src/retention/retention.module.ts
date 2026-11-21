import { Module } from '@nestjs/common';
import { AppSettingModule } from 'src/app-setting/app-setting.module';
import { RetentionService } from './retention.service';
import { PrismaRetentionRepository } from './repositories/prisma/prisma-retention-repository';

// A limpeza diária das tabelas sem retenção (avisos, registos dos testes ao vivo)
@Module({
  imports: [AppSettingModule],
  providers: [
    RetentionService,
    { provide: PrismaRetentionRepository, useClass: PrismaRetentionRepository },
  ],
})
export class RetentionModule {}

import { Module } from '@nestjs/common';
import { LiveTestController } from './live-test.controller';
import { LiveTestEventsService } from './live-test-events.service';
import { LiveTestService } from './live-test.service';
import { PrismaLiveTestRepository } from './repositories/prisma/prisma-live-test-repository';

// Os testes ao vivo: a estratégia de uma simulação com as velas da corretora em
// tempo real. Quem os corre é o simulador (o processo `live`); aqui criam-se,
// param-se e passam-se ao browser (SSE)
@Module({
  controllers: [LiveTestController],
  providers: [
    LiveTestService,
    LiveTestEventsService,
    {
      provide: PrismaLiveTestRepository,
      useClass: PrismaLiveTestRepository,
    },
  ],
})
export class LiveTestModule {}

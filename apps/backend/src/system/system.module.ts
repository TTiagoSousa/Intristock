import { Module } from '@nestjs/common';
import { NotificationModule } from 'src/notification/notification.module';
import { PrismaSystemRepository } from './repositories/prisma/prisma-system-repository';
import { SystemController } from './system.controller';
import { SystemService } from './system.service';
import { VersionWatchService } from './version-watch.service';
import { VersionsController } from './versions.controller';

@Module({
  imports: [NotificationModule],
  controllers: [SystemController, VersionsController],
  providers: [
    SystemService,
    VersionWatchService,
    { provide: PrismaSystemRepository, useClass: PrismaSystemRepository },
  ],
})
export class SystemModule {}

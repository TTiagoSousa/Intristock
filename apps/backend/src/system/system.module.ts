import { Module } from '@nestjs/common';
import { NotificationModule } from 'src/notification/notification.module';
import { AppSettingModule } from 'src/app-setting/app-setting.module';
import { BackupWatchService } from './backup-watch.service';
import { PrismaSystemRepository } from './repositories/prisma/prisma-system-repository';
import { SystemController } from './system.controller';
import { SystemService } from './system.service';
import { VersionWatchService } from './version-watch.service';
import { VersionsController } from './versions.controller';

@Module({
  imports: [NotificationModule, AppSettingModule],
  controllers: [SystemController, VersionsController],
  providers: [
    SystemService,
    VersionWatchService,
    BackupWatchService,
    { provide: PrismaSystemRepository, useClass: PrismaSystemRepository },
  ],
})
export class SystemModule {}

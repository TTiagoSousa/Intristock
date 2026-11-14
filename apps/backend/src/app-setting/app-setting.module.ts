import { Module } from '@nestjs/common';
import { AppSettingController } from './app-setting.controller';
import { AppSettingService } from './app-setting.service';
import { PrismaAppSettingRepository } from './repositories/prisma/prisma-app-setting-repository';

@Module({
  controllers: [AppSettingController],
  providers: [
    AppSettingService,
    {
      provide: PrismaAppSettingRepository,
      useClass: PrismaAppSettingRepository,
    },
  ],
  exports: [AppSettingService],
})
export class AppSettingModule {}

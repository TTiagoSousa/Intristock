import { Module } from '@nestjs/common';
import { PlatformService } from './platform.service';
import { PlatformController } from './platform.controller';
import { PrismaPlatformRepository } from './repositories/prisma/prisma-platform-repository';
import { CountryModule } from 'src/country/country.module';
import { AppSettingModule } from 'src/app-setting/app-setting.module';
import { PropFirmSyncService } from './prop-firm-sync.service';

@Module({
  imports: [CountryModule, AppSettingModule],
  controllers: [PlatformController],
  providers: [
    PlatformService,
    PropFirmSyncService,
    {
      provide: PrismaPlatformRepository,
      useClass: PrismaPlatformRepository,
    },
  ],
  exports: [PrismaPlatformRepository],
})
export class PlatformModule {}

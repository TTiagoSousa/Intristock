import { Module } from '@nestjs/common';
import { CatalogSeedService } from './catalog-seed.service';
import { PrismaCatalogSeedRepository } from './repositories/prisma/prisma-catalog-seed-repository';

@Module({
  providers: [
    CatalogSeedService,
    {
      provide: PrismaCatalogSeedRepository,
      useClass: PrismaCatalogSeedRepository,
    },
  ],
  exports: [CatalogSeedService],
})
export class CatalogSeedModule {}

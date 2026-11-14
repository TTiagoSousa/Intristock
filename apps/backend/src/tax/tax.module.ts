import { Module } from '@nestjs/common';
import { TaxService } from './tax.service';
import { TaxController } from './tax.controller';
import { PrismaTaxRepository } from './repositories/prisma/prisma-tax-repository';
import { CountryModule } from 'src/country/country.module';

@Module({
  imports: [CountryModule],
  controllers: [TaxController],
  providers: [
    TaxService,
    {
      provide: PrismaTaxRepository,
      useClass: PrismaTaxRepository,
    },
  ],
  exports: [PrismaTaxRepository],
})
export class TaxModule {}

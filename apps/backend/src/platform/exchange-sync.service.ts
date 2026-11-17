import { ConflictException, Injectable, Logger } from '@nestjs/common';
import { AppSettingService } from 'src/app-setting/app-setting.service';
import { PrismaCountryRepository } from 'src/country/repositories/prisma/prisma-country-repository';
import { PrismaPlatformRepository } from './repositories/prisma/prisma-platform-repository';
import { EXCHANGE_TYPE, syncExchanges } from './helpers/syncExchanges';

/** O atualizar das exchanges (CoinGecko → plataformas). Uns segundos; um de cada vez. */
@Injectable()
export class ExchangeSyncService {
  private readonly logger = new Logger(ExchangeSyncService.name);
  private running = false;

  constructor(
    private readonly appSettingService: AppSettingService,
    private readonly platformRepository: PrismaPlatformRepository,
    private readonly countryRepository: PrismaCountryRepository,
  ) {}

  /** Todas as exchanges da base (de qualquer origem), com o país; sem ir à API. */
  async list() {
    return this.platformRepository.findByTypeWithCountry(EXCHANGE_TYPE);
  }

  async sync() {
    if (this.running) throw new ConflictException('As exchanges já estão a ser atualizadas');
    const config = await this.appSettingService.apiConfig('exchange');
    this.running = true;
    try {
      const result = await syncExchanges(config, this.platformRepository, this.countryRepository);
      this.logger.log(`Exchanges: ${JSON.stringify(result)}`);
      return result;
    } finally {
      this.running = false;
    }
  }
}

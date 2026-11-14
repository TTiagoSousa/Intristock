import { Injectable, Logger, OnApplicationBootstrap } from '@nestjs/common';
import { PrismaCatalogSeedRepository } from './repositories/prisma/prisma-catalog-seed-repository';
import { ensureSystemCatalog } from './helpers/ensureSystemCatalog';

@Injectable()
export class CatalogSeedService implements OnApplicationBootstrap {
  private readonly logger = new Logger(CatalogSeedService.name);

  constructor(private readonly catalogSeedRepository: PrismaCatalogSeedRepository) {}

  // No arranque entra o que não depende de países (calculadoras, plataformas
  // internacionais) e, numa instalação que já os tem, o resto que faltar
  async onApplicationBootstrap() {
    try {
      const created = await this.ensure();
      const total = created.taxes + created.platforms + created.calculators + created.modules;
      if (total > 0) this.logger.log(`Catálogo pré-definido: ${JSON.stringify(created)}`);
    } catch (error) {
      // Um catálogo por completar não pode impedir a app de arrancar
      this.logger.warn(`Não foi possível completar o catálogo: ${(error as Error).message}`);
    }
  }

  ensure() {
    return ensureSystemCatalog(this.catalogSeedRepository);
  }
}

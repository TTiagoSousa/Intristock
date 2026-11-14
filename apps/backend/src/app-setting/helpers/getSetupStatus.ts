import { PrismaAppSettingRepository } from '../repositories/prisma/prisma-app-setting-repository';
import { readApiSettings } from './readApiSettings';

/**
 * Se a instalação já está pronta a usar. Fica configurada quando as duas APIs
 * têm chave **e** já há países e moedas na base de dados — com as chaves gravadas
 * mas a primeira sincronização falhada, o assistente volta a aparecer.
 */
export async function getSetupStatus(repository: PrismaAppSettingRepository) {
  const [currency, country, catalog] = await Promise.all([
    readApiSettings('currency', repository),
    readApiSettings('country', repository),
    repository.countCatalog(),
  ]);

  const apis = { currency: Boolean(currency.key), country: Boolean(country.key) };

  return {
    configured: apis.currency && apis.country && catalog.countries > 0 && catalog.currencies > 0,
    apis,
    catalog,
  };
}

/**
 * Fornecedores de cada API externa que a instalação aceita. Por agora há um de
 * cada; a lista existe para o admin escolher quando houver mais, e cada um traz o
 * endereço por omissão para o formulário já vir preenchido.
 */
export interface ApiProvider {
  id: string;
  label: string;
  defaultUrl: string;
  docsUrl: string;
  // Sem chave: a API é pública (falta = precisa)
  keyRequired?: boolean;
  // Pública, mas com chave grátis dá mais pedidos: o campo aparece e pode ficar em branco
  keyOptional?: boolean;
}

export const CURRENCY_PROVIDERS: ApiProvider[] = [
  {
    id: 'currencybeacon',
    label: 'CurrencyBeacon',
    defaultUrl: 'https://api.currencybeacon.com/v1',
    docsUrl: 'https://currencybeacon.com/register',
  },
];

export const COUNTRY_PROVIDERS: ApiProvider[] = [
  {
    id: 'countrystatecity',
    label: 'Country State City',
    defaultUrl: 'https://api.countrystatecity.in/v1',
    docsUrl: 'https://countrystatecity.in/',
  },
];

// As prop firms e os planos delas (regras, preços); pública, sem chave
export const PROPFIRM_PROVIDERS: ApiProvider[] = [
  {
    id: 'propfirmmap',
    label: 'PropFirmMap',
    defaultUrl: 'https://propfirmmap.com/api/v1',
    docsUrl: 'https://propfirmmap.com/api/docs',
    keyRequired: false,
  },
];

// As exchanges de cripto (nome, site, logótipo, país); funciona sem chave, a Demo (grátis) dá mais pedidos
export const EXCHANGE_PROVIDERS: ApiProvider[] = [
  {
    id: 'coingecko',
    label: 'CoinGecko',
    defaultUrl: 'https://api.coingecko.com/api/v3',
    docsUrl: 'https://www.coingecko.com/en/api/pricing',
    keyRequired: false,
    keyOptional: true,
  },
];

export type ApiKind = 'currency' | 'country' | 'propfirm' | 'exchange';

export const PROVIDERS_BY_KIND: Record<ApiKind, ApiProvider[]> = {
  currency: CURRENCY_PROVIDERS,
  country: COUNTRY_PROVIDERS,
  propfirm: PROPFIRM_PROVIDERS,
  exchange: EXCHANGE_PROVIDERS,
};

// O que se diz quando a API ainda não foi configurada
export const API_LABEL: Record<ApiKind, string> = {
  currency: 'de moedas',
  country: 'de países',
  propfirm: 'de prop firms',
  exchange: 'de exchanges',
};

/** Se o fornecedor escolhido pede chave (sem fornecedor guardado, o primeiro). */
export const needsKey = (kind: ApiKind, providerId: string | null) => {
  const providers = PROVIDERS_BY_KIND[kind];
  const provider = providers.find((p) => p.id === providerId) ?? providers[0];
  return provider.keyRequired !== false;
};

export const settingKey = (kind: ApiKind, field: 'provider' | 'url' | 'key') => `api.${kind}.${field}`;

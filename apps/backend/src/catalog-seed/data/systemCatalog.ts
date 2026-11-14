/**
 * O catálogo que vem com a instalação, como o ERPNext traz os impostos de cada país.
 * Tudo entra com `type: 'system'` (impostos) e só se cria o que ainda não existe com
 * o mesmo nome — o que o admin acrescentou ou alterou nunca é tocado.
 *
 * Impostos e plataformas de um país só entram quando esse país existe na base de
 * dados, ou seja, depois da primeira sincronização de países.
 */

export interface SystemTax {
  countryIso2: string;
  name: string;
  rate: number;
  category: string;
  description: string;
}

// Taxas de IVA em vigor e estáveis. As regiões autónomas (Madeira, Açores) e
// outros países ficam para o admin acrescentar em Definições → Impostos.
export const SYSTEM_TAXES: SystemTax[] = [
  { countryIso2: 'PT', name: 'IVA 23%', rate: 23, category: 'vat', description: 'Taxa normal (Portugal continental)' },
  { countryIso2: 'PT', name: 'IVA 13%', rate: 13, category: 'vat', description: 'Taxa intermédia (Portugal continental)' },
  { countryIso2: 'PT', name: 'IVA 6%', rate: 6, category: 'vat', description: 'Taxa reduzida (Portugal continental)' },
  { countryIso2: 'PT', name: 'IVA 0% (isento)', rate: 0, category: 'vat', description: 'Operações isentas ou com autoliquidação' },

  { countryIso2: 'ES', name: 'IVA 21%', rate: 21, category: 'vat', description: 'Tipo general' },
  { countryIso2: 'ES', name: 'IVA 10%', rate: 10, category: 'vat', description: 'Tipo reducido' },
  { countryIso2: 'ES', name: 'IVA 4%', rate: 4, category: 'vat', description: 'Tipo superreducido' },

  { countryIso2: 'FR', name: 'TVA 20%', rate: 20, category: 'vat', description: 'Taux normal' },
  { countryIso2: 'FR', name: 'TVA 10%', rate: 10, category: 'vat', description: 'Taux intermédiaire' },
  { countryIso2: 'FR', name: 'TVA 5,5%', rate: 5.5, category: 'vat', description: 'Taux réduit' },
  { countryIso2: 'FR', name: 'TVA 2,1%', rate: 2.1, category: 'vat', description: 'Taux particulier' },

  { countryIso2: 'DE', name: 'MwSt 19%', rate: 19, category: 'vat', description: 'Regelsteuersatz' },
  { countryIso2: 'DE', name: 'MwSt 7%', rate: 7, category: 'vat', description: 'Ermäßigter Steuersatz' },

  { countryIso2: 'IT', name: 'IVA 22%', rate: 22, category: 'vat', description: 'Aliquota ordinaria' },
  { countryIso2: 'IT', name: 'IVA 10%', rate: 10, category: 'vat', description: 'Aliquota ridotta' },
  { countryIso2: 'IT', name: 'IVA 5%', rate: 5, category: 'vat', description: 'Aliquota ridotta' },
  { countryIso2: 'IT', name: 'IVA 4%', rate: 4, category: 'vat', description: 'Aliquota minima' },

  { countryIso2: 'GB', name: 'VAT 20%', rate: 20, category: 'vat', description: 'Standard rate' },
  { countryIso2: 'GB', name: 'VAT 5%', rate: 5, category: 'vat', description: 'Reduced rate' },
];

export interface SystemPlatform {
  name: string;
  type: 'bank' | 'broker' | 'exchange' | 'postal';
  website: string;
  // Sem país: plataforma internacional, entra logo no primeiro arranque
  countryIso2?: string;
}

export const SYSTEM_PLATFORMS: SystemPlatform[] = [
  { name: 'Caixa Geral de Depósitos', type: 'bank', website: 'https://www.cgd.pt', countryIso2: 'PT' },
  { name: 'Millennium bcp', type: 'bank', website: 'https://www.millenniumbcp.pt', countryIso2: 'PT' },
  { name: 'Santander', type: 'bank', website: 'https://www.santander.pt', countryIso2: 'PT' },
  { name: 'novobanco', type: 'bank', website: 'https://www.novobanco.pt', countryIso2: 'PT' },
  { name: 'BPI', type: 'bank', website: 'https://www.bancobpi.pt', countryIso2: 'PT' },
  { name: 'Banco Montepio', type: 'bank', website: 'https://www.bancomontepio.pt', countryIso2: 'PT' },
  { name: 'Crédito Agrícola', type: 'bank', website: 'https://www.creditoagricola.pt', countryIso2: 'PT' },
  { name: 'ActivoBank', type: 'bank', website: 'https://www.activobank.pt', countryIso2: 'PT' },
  { name: 'Banco CTT', type: 'bank', website: 'https://www.bancoctt.pt', countryIso2: 'PT' },
  { name: 'Bankinter', type: 'bank', website: 'https://www.bankinter.pt', countryIso2: 'PT' },
  { name: 'CTT', type: 'postal', website: 'https://www.ctt.pt', countryIso2: 'PT' },

  { name: 'Revolut', type: 'bank', website: 'https://www.revolut.com' },
  { name: 'Wise', type: 'bank', website: 'https://wise.com' },
  { name: 'N26', type: 'bank', website: 'https://n26.com' },

  { name: 'Trade Republic', type: 'broker', website: 'https://traderepublic.com' },
  { name: 'Interactive Brokers', type: 'broker', website: 'https://www.interactivebrokers.com' },
  { name: 'DEGIRO', type: 'broker', website: 'https://www.degiro.pt' },
  { name: 'XTB', type: 'broker', website: 'https://www.xtb.com' },
  { name: 'eToro', type: 'broker', website: 'https://www.etoro.com' },

  { name: 'Binance', type: 'exchange', website: 'https://www.binance.com' },
  { name: 'Kraken', type: 'exchange', website: 'https://www.kraken.com' },
  { name: 'Coinbase', type: 'exchange', website: 'https://www.coinbase.com' },
];

// A página de cada calculadora é escrita à mão no frontend; a linha do catálogo é
// o que a faz aparecer na lista e guardar simulações.
export const SYSTEM_CALCULATORS = [
  {
    abbreviation: 'compound-interest',
    name: 'Compound Interest Calculator',
    description:
      'Calculates the future value of an investment using compound interest, including periodic additional contributions.',
  },
];

// Os módulos que cada empresa pode ligar (Empresa → Módulos). `icon` é o nome de
// um ícone do frontend; o nome e a descrição no ecrã vêm das traduções pelo `name`.
export const SYSTEM_MODULES = [
  {
    name: 'trading',
    label: 'Trading',
    description: 'Trading accounts at brokers and prop firms, with their rules, results and statistics.',
    icon: 'Candles',
  },
];

import * as Icon from '../../../../Imports/icons';

// O icon guardado no módulo é o nome de um dos ícones do projeto
export const MODULE_ICONS: Record<string, (typeof Icon)[keyof typeof Icon]> = {
  Home: Icon.Home,
  Company: Icon.Company,
  Calculator: Icon.Calculator,
  Wallet: Icon.Wallet,
  Simulations: Icon.Simulations,
  Candles: Icon.Candles,
  Phone: Icon.Phone,
};

// A área de cada módulo na empresa (`/Companies/:slug/<caminho>`), pelo `Module.name`
export const MODULE_PATHS: Record<string, string> = {
  trading: 'trading',
  call_center: 'call-center',
};

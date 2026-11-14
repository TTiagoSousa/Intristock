import { createContext, useContext, useEffect, useState, type ReactNode } from 'react';
import http from '../Service/httpService';
import { End_Points } from '../Service/endPoints';
import { useAsyncRequest } from '../Hooks/useAsyncRequest';

export interface Currency {
  id: string;
  name: string;
  shortCode: string;
  symbol: string;
  symbolFirst: boolean;
  decimalMark: string;
  thousandsSeparator: string;
  rate: number;
}

interface CurrencyContextType {
  currencies: Currency[];
  loading: boolean;
  selectedCurrency: string;
  setSelectedCurrency: (shortCode: string) => void;
  // Volta a pedir a lista — depois de o admin sincronizar as moedas
  refresh: () => Promise<void>;
}

const CURRENCY_STORAGE_KEY = 'currency';
const DEFAULT_CURRENCY = 'EUR';

const CurrencyContext = createContext<CurrencyContextType | undefined>(undefined);

export function CurrencyProvider({ children }: { children: ReactNode }) {
  const [currencies, setCurrencies] = useState<Currency[]>([]);
  const [storedCurrency, setSelectedCurrencyState] = useState(
    () => localStorage.getItem(CURRENCY_STORAGE_KEY) || DEFAULT_CURRENCY,
  );
  // Uma moeda que deixou de se poder escolher (o site só tem EUR, USD e BRL) passa ao euro
  const selectedCurrency =
    currencies.length && !currencies.some((currency) => currency.shortCode === storedCurrency)
      ? DEFAULT_CURRENCY
      : storedCurrency;

  const { loading, run } = useAsyncRequest(true);

  const setSelectedCurrency = (shortCode: string) => {
    localStorage.setItem(CURRENCY_STORAGE_KEY, shortCode);
    setSelectedCurrencyState(shortCode);
  };

  const refresh = async () => {
    const response = await run(() => http.get(End_Points.Currency_Endpoint()));
    if (response) setCurrencies(response.data);
  };

  useEffect(() => {
    refresh();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  return (
    <CurrencyContext.Provider value={{ currencies, loading, selectedCurrency, setSelectedCurrency, refresh }}>
      {children}
    </CurrencyContext.Provider>
  );
}

export function useCurrency() {
  const context = useContext(CurrencyContext);

  if (context === undefined) {
    throw new Error('useCurrency must be used within a CurrencyProvider');
  }

  return context;
}

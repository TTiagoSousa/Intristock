import { useState } from 'react';
import http from '../../Service/httpService';
import { End_Points } from '../../Service/endPoints';
import { getErrorMessage } from '../useAsyncRequest';

export type SyncTarget = 'countries' | 'currencies' | 'rates';

export interface SyncResult {
  ok: boolean;
  // Quantas linhas a API trouxe (países, moedas ou cotações atualizadas)
  count: number;
  message: string;
}

const ENDPOINTS: Record<SyncTarget, () => string> = {
  countries: End_Points.Countries_Sync_Endpoint,
  currencies: End_Points.Currencies_Sync_Endpoint,
  rates: End_Points.Currency_Rates_Endpoint,
};

/**
 * Os botões de "Atualizar APIs" e os passos do primeiro arranque. Cada
 * sincronização guarda o seu resultado ao lado do botão — num alerta que se vai
 * em 3 segundos perdia-se qual das três é que falhou.
 */
export const useCatalogSync = () => {
  const [running, setRunning] = useState<SyncTarget | null>(null);
  const [results, setResults] = useState<Partial<Record<SyncTarget, SyncResult>>>({});

  const sync = async (target: SyncTarget): Promise<SyncResult> => {
    setRunning(target);
    let result: SyncResult;

    try {
      const response = await http.post(ENDPOINTS[target]());
      const data = response.data as { synced?: number; updated?: number };
      result = { ok: true, count: data.synced ?? data.updated ?? 0, message: '' };
    } catch (error) {
      result = { ok: false, count: 0, message: getErrorMessage(error) };
    }

    setResults((current) => ({ ...current, [target]: result }));
    setRunning(null);
    return result;
  };

  return { running, results, sync };
};

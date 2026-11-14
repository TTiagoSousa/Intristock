import { useEffect, useState } from 'react';
import http from '../../Service/httpService';
import { End_Points } from '../../Service/endPoints';

export type ApiHealthStatus = 'online' | 'key_rejected' | 'offline' | 'unconfigured';

export interface ApiHealth {
  status: ApiHealthStatus;
  latencyMs: number | null;
  httpStatus: number | null;
  checkedAt: string;
}

export interface ApisHealth {
  currency: ApiHealth;
  country: ApiHealth;
  propfirm: ApiHealth;
  catalog: { countries: number; currencies: number; ratesUpdatedAt: string | null };
}

/**
 * Se as APIs respondem com as chaves guardadas. Testa ao abrir a página e
 * quando se pede (botão Testar, depois de guardar ou de atualizar dados).
 */
export const useApisHealth = () => {
  const [health, setHealth] = useState<ApisHealth | null>(null);
  const [checking, setChecking] = useState(true);

  const request = () =>
    http
      .get<ApisHealth>(End_Points.Setup_Apis_Health_Endpoint())
      .then((response) => setHealth(response.data))
      // Sem resposta do nosso backend: os cartões ficam "por testar"
      .catch(() => undefined)
      .finally(() => setChecking(false));

  const check = () => {
    setChecking(true);
    return request();
  };

  // Ao abrir já começa "a testar"; o estado só muda quando a resposta chega
  useEffect(() => {
    request();
  }, []);

  return { health, checking, check };
};

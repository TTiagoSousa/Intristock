import { useEffect, useState } from 'react';
import http from '../../Service/httpService';
import { End_Points } from '../../Service/endPoints';

export interface SetupStatus {
  // Pronta a usar: as duas APIs com chave e já com países e moedas
  configured: boolean;
  apis: { currency: boolean; country: boolean };
  catalog: { countries: number; currencies: number };
}

/**
 * Se a instalação já passou pelo primeiro arranque. Sem `useAsyncRequest` de
 * propósito: um erro aqui não deve abrir um alerta por cima do ecrã de entrada —
 * a app segue em frente e as páginas mostram os seus próprios erros.
 */
export const useSetupStatus = () => {
  const [status, setStatus] = useState<SetupStatus | null>(null);
  const [loading, setLoading] = useState(true);

  const refresh = async () => {
    try {
      const response = await http.get<SetupStatus>(End_Points.Setup_Status_Endpoint());
      setStatus(response.data);
    } catch {
      setStatus(null);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    refresh();
  }, []);

  return { status, loading, refresh };
};

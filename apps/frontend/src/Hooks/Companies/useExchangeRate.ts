import { useEffect, useState } from 'react';
import http from '../../Service/httpService';
import { End_Points } from '../../Service/endPoints';
import { getErrorMessage } from '../useAsyncRequest';

interface Exchange_Rate_State {
  // Os parâmetros a que esta resposta corresponde — uma resposta de outro dia
  // ou de outra moeda não serve
  key: string;
  rate: number | null;
  error: string | null;
}

/**
 * A cotação de mercado de um dia: quanto vale 1 de `fromCurrencyId` em
 * `toCurrencyId`. Serve para propor, no formulário, o valor de um pagamento na
 * moeda da empresa. O backend guarda-a, por isso o mesmo dia só gasta um pedido
 * à API de moedas.
 *
 * Sem pedido quando as moedas são iguais ou falta a data. O erro não vai para o
 * alerta: sem cotação, o formulário pede o valor à mão, e é aí que se diz.
 */
export const useExchangeRate = (
  fromCurrencyId: string,
  toCurrencyId: string,
  date: string,
) => {
  const key = `${fromCurrencyId}|${toCurrencyId}|${date}`;
  const wanted = Boolean(fromCurrencyId && toCurrencyId && date) && fromCurrencyId !== toCurrencyId;
  const [state, setState] = useState<Exchange_Rate_State | null>(null);

  useEffect(() => {
    if (!wanted) return;

    let current = true;

    http
      .get<{ rate: number }>(End_Points.Currency_Rate_Endpoint(), {
        params: { from: fromCurrencyId, to: toCurrencyId, date },
      })
      .then(({ data }) => {
        if (current) setState({ key, rate: data.rate, error: null });
      })
      .catch((error) => {
        if (current) setState({ key, rate: null, error: getErrorMessage(error) });
      });

    // Mudou a data ou a moeda a meio: a resposta antiga é deitada fora
    return () => {
      current = false;
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [key, wanted]);

  const answered = wanted && state?.key === key;

  return {
    rate: answered ? state.rate : null,
    error: answered ? state.error : null,
    loading: wanted && !answered,
  };
};

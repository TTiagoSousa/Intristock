import { createContext, useContext } from 'react';
import type { Indicator_Form } from './simulationForm';

/**
 * Os indicadores da estratégia, para qualquer valor de qualquer condição os
 * oferecer na lista (sem os passar de cartão em cartão), e o "+ Novo indicador"
 * da lista, que cria um e devolve o id para o valor o usar logo. Só se oferece o
 * que o utilizador pôs nos Indicadores: nada se cria nem se liga sozinho.
 */
export interface Indicators_Context_Value {
  indicators: Indicator_Form[];
  addIndicator: () => string;
}

export const Indicators_Context = createContext<Indicators_Context_Value>({
  indicators: [],
  addIndicator: () => '',
});

export const useIndicators = () => useContext(Indicators_Context);

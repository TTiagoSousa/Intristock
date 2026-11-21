/**
 * O formulário do simulador: o estado em que se edita, os valores por omissão
 * e a passagem para o pedido (e de volta, ao abrir uma simulação pelo URL).
 *
 * No ecrã não há velas -1/-2: as condições veem-se com as velas fechadas, por
 * isso "Fecho" é o da última vela fechada (-2 no motor), "há 1 vela" a anterior
 * (-3) e a "Abertura atual" é a abertura da vela que está a começar (-1, a única
 * coisa que se sabe dela). As médias definem-se uma vez, como indicadores, e
 * usam-se pelo nome; no pedido cada uso vira uma média com os valores dele.
 *
 * Cada parte está num ficheiro ao lado e fica também exportada daqui:
 * formState (as opções, os limites e as formas), formDefaults (os valores novos),
 * formPayload (do formulário para o pedido e a validação), formWarmup (o
 * aquecimento) e formFromRun (de uma simulação gravada para o formulário).
 */
export * from './formState';
export * from './formDefaults';
export * from './formPayload';
export * from './formWarmup';
export * from './formFromRun';

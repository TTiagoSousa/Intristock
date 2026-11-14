// O que se vê na página de uma simulação. Os quatro primeiros são os
// separadores do formulário (Settings); o 'result' é o separador do simulador.
// Na página, o resultado é o Resumo (os números e a nota), a Estratégia (a ficha
// da simulação, 'setup'), as Provas ('proofs'), as Entradas e saídas ('entries'), os Horários ('hours'), o Gráfico (velas com as entradas e saídas) e o Teste ao vivo ('live')
export type Run_Tab =
  | 'general'
  | 'indicators'
  | 'strategy'
  | 'rules'
  | 'result'
  | 'summary'
  | 'setup'
  | 'proofs'
  | 'entries'
  | 'hours'
  | 'chart'
  | 'live';

export const SETTINGS_TABS: Run_Tab[] = ['general', 'indicators', 'strategy', 'rules'];

// Na página de uma simulação o separador vai no endereço (?view=), para a barra
// lateral o mostrar e mudar; sem ele, o Resumo
export const RUN_VIEW_PARAM = 'view';
export const RUN_VIEWS: Run_Tab[] = [...SETTINGS_TABS, 'summary', 'setup', 'proofs', 'entries', 'hours', 'chart', 'live'];

export const runViewOf = (search: string): Run_Tab => {
  const view = new URLSearchParams(search).get(RUN_VIEW_PARAM) as Run_Tab | null;
  return view && RUN_VIEWS.includes(view) ? view : 'summary';
};

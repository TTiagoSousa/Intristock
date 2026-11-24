/** As Leads do call center: secções (quadros) com as linhas de uma tabela ou tabela unida, em colunas. */

export const LEAD_SOURCE_TYPES = ['table', 'view'] as const;
export type LeadSourceType = (typeof LEAD_SOURCE_TYPES)[number];

/// As colunas de uma secção nova; a primeira é a de entrada (onde aparecem as leads que passam os filtros)
export const DEFAULT_STAGES = ['Por ligar', '1.ª chamada', 'Atendeu', 'Não atendeu', 'Quer a encomenda', 'Não quer'];

/// As linhas que um quadro mostra de cada vez (as que passam os filtros; as que já foram mexidas vêm sempre)
export const MAX_BOARD_ROWS = 500;
export const MAX_STAGES = 12;
export const MAX_CARD_COLUMNS = 6;
export const MAX_BOARDS = 30;
export const MAX_COMMENT = 4000;

/// A posição das leads que ainda ninguém mexeu, na coluna de entrada, pela ordem da origem (depois das mexidas)
export const UNTOUCHED_POSITION = 1_000_000;

/// Os botões de resultado de uma secção nova: o nome, a coluna (pelo nome das por omissão), se atendeu e se pede a data
export const DEFAULT_OUTCOMES = [
  { name: 'Atendeu', stage: 'Atendeu', answered: true, asksCallback: false },
  { name: 'Não atendeu', stage: 'Não atendeu', answered: false, asksCallback: true },
  { name: 'Caixa de correio', stage: 'Não atendeu', answered: false, asksCallback: true },
  { name: 'Número errado', stage: 'Não quer', answered: false, asksCallback: false },
];
export const MAX_OUTCOMES = 10;
export const MAX_CALLBACK_NOTE = 300;
/// Quantas leads se mexem de uma vez (escolher várias no quadro)
export const MAX_BULK = 200;
/// O máximo de cartões que se mostram de início numa coluna (o limite de cada uma)
export const MAX_CARD_LIMIT = 500;

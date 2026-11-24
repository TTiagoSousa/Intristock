import type { Data_Column, Data_Column_Type } from '../../../../Hooks/Companies/useCompanyData';
import { columnKeyOf } from './dataHelpers';

// As colunas enquanto se editam (Data_Columns_Editor) e o que vai no pedido

/**
 * Uma coluna enquanto se edita. O `draftId` não muda enquanto se escreve o nome (a chave escolhida
 * aponta para ele); a `key` a sério só se decide ao gravar, nas colunas novas (`key` vazia).
 */
export interface Column_Draft {
  draftId: string;
  key: string;
  label: string;
  type: Data_Column_Type;
  personal: boolean;
  hidden: boolean;
  sourceHeader: string | null;
  // Só num ficheiro: se a coluna entra na tabela, e uns valores de exemplo
  keep: boolean;
  samples?: string[];
}

let draftCounter = 0;
export const newDraftId = () => `d${++draftCounter}`;

export const draftFromColumn = (column: Data_Column): Column_Draft => ({
  draftId: newDraftId(),
  key: column.key,
  label: column.label,
  type: column.type,
  personal: column.personal,
  hidden: column.hidden,
  sourceHeader: column.sourceHeader ?? null,
  keep: true,
});

export const emptyDraft = (): Column_Draft => ({
  draftId: newDraftId(),
  key: '',
  label: '',
  type: 'text',
  personal: false,
  hidden: false,
  sourceHeader: null,
  keep: true,
});

/**
 * As colunas que vão no pedido: só as que ficam, com o nome sem espaços à volta, e uma key para
 * as novas (do nome, sem repetir as que já há). Devolve também a key da coluna chave.
 */
export const draftsToColumns = (drafts: Column_Draft[], keyDraftId: string | null) => {
  const kept = drafts.filter((draft) => draft.keep);
  const taken = new Set(kept.map((draft) => draft.key).filter(Boolean));
  let keyColumn: string | null = null;
  const columns: Data_Column[] = kept.map((draft) => {
    const key = draft.key || columnKeyOf(draft.label || draft.sourceHeader || '', taken);
    taken.add(key);
    if (draft.draftId === keyDraftId) keyColumn = key;
    return {
      key,
      label: draft.label.trim() || draft.sourceHeader || key,
      type: draft.type,
      personal: draft.personal,
      hidden: draft.hidden,
      sourceHeader: draft.sourceHeader,
    };
  });
  return { columns, keyColumn };
};

/** O que falta para se poder gravar: um nome em cada coluna que fica e nenhum repetido. */
export const draftsProblem = (drafts: Column_Draft[]): 'none' | 'empty' | 'label' | 'duplicate' => {
  const kept = drafts.filter((draft) => draft.keep);
  if (kept.length === 0) return 'empty';
  if (kept.some((draft) => !draft.label.trim())) return 'label';
  const labels = kept.map((draft) => draft.label.trim().toLowerCase());
  if (new Set(labels).size !== labels.length) return 'duplicate';
  return 'none';
};

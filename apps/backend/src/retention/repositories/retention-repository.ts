// O que se apaga na limpeza diária (tabelas que só crescem)
export interface RetentionRepository {
  /** Apaga até `limit` avisos lidos antes de `before` (os que esperam resposta ficam). Devolve quantos. */
  deleteReadNotifications(before: Date, limit: number): Promise<number>;
  /** Apaga até `limit` registos destes tipos, de antes de `before`, de testes ao vivo já acabados. */
  deleteLiveTestEvents(kinds: string[], statuses: string[], before: Date, limit: number): Promise<number>;
}

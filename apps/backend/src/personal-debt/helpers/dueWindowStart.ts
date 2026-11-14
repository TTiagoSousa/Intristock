// Os meses para trás onde ainda se mostram prestações por pagar (em atraso)
export const OVERDUE_MONTHS = 3;

// O primeiro dia do mês a partir do qual se procuram as prestações por pagar
export function dueWindowStart(now: Date) {
  return new Date(
    Date.UTC(now.getUTCFullYear(), now.getUTCMonth() - OVERDUE_MONTHS, 1),
  );
}

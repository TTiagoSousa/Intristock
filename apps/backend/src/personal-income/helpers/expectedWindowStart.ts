// Os meses para trás onde ainda se mostram salários por receber (em atraso)
export const OVERDUE_MONTHS = 3;

// O primeiro dia do mês a partir do qual se procuram os ganhos esperados
export function expectedWindowStart(now: Date) {
  return new Date(
    Date.UTC(now.getUTCFullYear(), now.getUTCMonth() - OVERDUE_MONTHS, 1),
  );
}

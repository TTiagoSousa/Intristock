// Sem fuso pedido (ou um que não existe), conta-se na hora de Lisboa
export const DEFAULT_TIMEZONE = 'Europe/Lisbon';

/** O fuso pedido, se existir; senão o de omissão. */
export function resolveTimezone(tz: string | undefined): string {
  if (!tz) return DEFAULT_TIMEZONE;
  try {
    new Intl.DateTimeFormat('en-CA', { timeZone: tz });
    return tz;
  } catch {
    return DEFAULT_TIMEZONE;
  }
}

/** O dia (YYYY-MM-DD) de um instante nesse fuso. */
export function localDay(date: Date, timeZone: string): string {
  return new Intl.DateTimeFormat('en-CA', { timeZone, year: 'numeric', month: '2-digit', day: '2-digit' }).format(date);
}

/** O início de um dia (YYYY-MM-DD) num fuso, em UTC: pela diferença do fuso ao meio-dia desse dia. */
export function startOfLocalDay(day: string, timeZone: string): Date {
  const noon = new Date(`${day}T12:00:00Z`);
  const local = new Date(noon.toLocaleString('en-US', { timeZone }));
  const utc = new Date(noon.toLocaleString('en-US', { timeZone: 'UTC' }));
  return new Date(new Date(`${day}T00:00:00Z`).getTime() - (local.getTime() - utc.getTime()));
}

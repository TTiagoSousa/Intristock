/** O dia UTC de uma data, em YYYY-MM-DD. */
export const isoDay = (date: Date): string => date.toISOString().slice(0, 10);

/** O mesmo, com nulo para uma data que não há. */
export const isoDayOrNull = (date: Date | null): string | null =>
  date ? isoDay(date) : null;

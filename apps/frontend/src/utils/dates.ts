// Datas no dia do browser (não em UTC): o `toISOString()` dá o dia em UTC e,
// entre a meia-noite e a uma da manhã do verão em Portugal, propunha a véspera.

const pad = (n: number) => String(n).padStart(2, '0');

// YYYY-MM-DD de uma data, no dia local
export const localDay = (date: Date = new Date()) =>
  `${date.getFullYear()}-${pad(date.getMonth() + 1)}-${pad(date.getDate())}`;

// Hoje, YYYY-MM-DD, no dia local
export const localToday = () => localDay(new Date());

// YYYY-MM de uma data, no mês local
export const localMonth = (date: Date = new Date()) =>
  `${date.getFullYear()}-${pad(date.getMonth() + 1)}`;

// O mês atual, YYYY-MM, no mês local
export const currentMonth = () => localMonth(new Date());

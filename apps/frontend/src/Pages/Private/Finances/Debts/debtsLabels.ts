import type { TFunction } from 'i18next';

// "nov 2026" de um YYYY-MM
export const formatMonth = (month: string, locale: string) =>
  new Date(`${month}-01T00:00:00Z`).toLocaleDateString(locale, { month: 'short', year: 'numeric', timeZone: 'UTC' }).replace('.', '');

// "Prestação de novembro" (ou "Reembolso de novembro", no que devem à pessoa)
export const installmentLabel = (t: TFunction, locale: string, period: string, direction: string) => {
  const month = new Date(`${period}-01T00:00:00Z`).toLocaleDateString(locale, { month: 'long', timeZone: 'UTC' });
  return t(direction === 'lent' ? 'debts.repaymentOf' : 'debts.installmentOf', { month });
};

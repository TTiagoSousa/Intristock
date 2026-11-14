import type { TFunction } from 'i18next';

export const localeOf = (language: string) => (language === 'pt' ? 'pt-PT' : 'en-GB');

export const formatDay = (value: string, locale: string) =>
  new Date(`${value}T00:00:00Z`).toLocaleDateString(locale, {
    day: '2-digit',
    month: 'short',
    year: 'numeric',
    timeZone: 'UTC',
  });

// "Salário de novembro", "Subsídio de Natal", "Recibo verde"
export const expectedPartLabel = (t: TFunction, locale: string, part: string | null, period: string | null) => {
  if (part === 'salary' && period) {
    const month = new Date(`${period.slice(0, 7)}-01T00:00:00Z`).toLocaleDateString(locale, {
      month: 'long',
      timeZone: 'UTC',
    });
    return t('upcomingPayments.part_salary', { month });
  }
  return part ? t(`upcomingPayments.part_${part}`) : '';
};

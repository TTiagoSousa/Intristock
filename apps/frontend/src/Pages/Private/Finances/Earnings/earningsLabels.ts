import type { TFunction } from 'i18next';

export { localeOf } from '../../../../utils/locale';

export const formatDay = (value: string, locale: string) =>
  new Date(`${value}T00:00:00Z`).toLocaleDateString(locale, {
    day: '2-digit',
    month: 'short',
    year: 'numeric',
    timeZone: 'UTC',
  });

// "Salário de novembro", "Subsídio de Natal", "Recibo verde", "Horas de novembro"
export const expectedPartLabel = (t: TFunction, locale: string, part: string | null, period: string | null) => {
  if (part === 'payout') return t('earnings.part_payout');
  if (part === 'hours' && period) {
    const month = new Date(`${period.slice(0, 7)}-01T00:00:00Z`).toLocaleDateString(locale, {
      month: 'long',
      timeZone: 'UTC',
    });
    return t('earnings.part_hours', { month });
  }
  if (part === 'salary' && period) {
    const month = new Date(`${period.slice(0, 7)}-01T00:00:00Z`).toLocaleDateString(locale, {
      month: 'long',
      timeZone: 'UTC',
    });
    return t('upcomingPayments.part_salary', { month });
  }
  return part ? t(`upcomingPayments.part_${part}`) : '';
};

/** O período de um pagamento a um membro (`YYYY-MM`, `YYYY-MM:holiday`, `YYYY-MM:christmas`, `once`) em texto. */
export const memberPeriodLabel = (t: TFunction, locale: string, period: string) =>
  expectedPartLabel(
    t,
    locale,
    period === 'once'
      ? 'freelance'
      : period.endsWith(':holiday')
        ? 'holiday'
        : period.endsWith(':christmas')
          ? 'christmas'
          : 'salary',
    period,
  );

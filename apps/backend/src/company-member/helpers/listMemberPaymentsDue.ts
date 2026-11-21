import { MemberPayWithMember } from '../repositories/company-member-repository';

// Os subsídios de quem recebe 14 vezes: o de férias em junho, o de Natal em dezembro
const HOLIDAY_MONTH = 5;
const CHRISTMAS_MONTH = 11;

const round = (value: number) => Math.round(value * 100) / 100;
const iso = (date: Date) => date.toISOString().slice(0, 10);

type Currency = { id: string; shortCode: string; symbol: string; rate: number };

/**
 * O que está por pagar aos membros entre `firstMonth` e `until`: cada salário no
 * dia dele em cada mês (e os subsídios de quem recebe 14 vezes) e os recibos
 * verdes até `until`, menos os períodos já pagos (`paid`, `payId|período`). Os
 * próximos pagamentos e a previsão do gráfico dos pagamentos saem daqui.
 */
export function listMemberPaymentsDue(
  pays: MemberPayWithMember[],
  paid: Set<string>,
  firstMonth: Date,
  until: Date,
  today: Date,
  companyCurrency: Currency | null,
) {
  const entry = (
    pay: MemberPayWithMember,
    date: Date,
    period: string,
    part: string,
  ) => {
    const gross = Number(pay.grossAmount);
    const withholding =
      pay.withholdingPct === null ? 0 : Number(pay.withholdingPct);
    return {
      memberId: pay.member.id,
      memberName: pay.member.name ?? pay.member.user?.fullName ?? '',
      memberPayId: pay.id,
      kind: pay.kind,
      // salary, holiday, christmas ou freelance
      part,
      period,
      date: iso(date),
      overdue: date < today,
      description: pay.description,
      grossAmount: round(gross),
      // O que sai do banco num recibo verde (o bruto menos a retenção); num
      // salário é o bruto, e o líquido escreve-se ao registar
      netAmount: round(gross * (1 - withholding / 100)),
      withholdingPct: pay.withholdingPct === null ? null : withholding,
      currency: pay.member.currency ?? companyCurrency,
      bankAccountId: pay.member.bankAccountId,
    };
  };

  const due: ReturnType<typeof entry>[] = [];

  for (const pay of pays) {
    if (pay.kind === 'freelance') {
      if (pay.dueDate && pay.dueDate <= until && !paid.has(`${pay.id}|once`)) {
        due.push(entry(pay, pay.dueDate, 'once', 'freelance'));
      }
      continue;
    }

    if (!pay.startDate || !pay.payDay) continue;

    for (
      let cursor = new Date(firstMonth);
      cursor <= until;
      cursor.setUTCMonth(cursor.getUTCMonth() + 1)
    ) {
      const year = cursor.getUTCFullYear();
      const month = cursor.getUTCMonth();
      const daysInMonth = new Date(Date.UTC(year, month + 1, 0)).getUTCDate();
      const date = new Date(
        Date.UTC(year, month, Math.min(pay.payDay, daysInMonth)),
      );
      // O último mês corta no `until` (o dia do salário pode cair depois dele)
      if (date > until) continue;
      if (date < pay.startDate || (pay.endDate && date > pay.endDate)) continue;

      const period = `${year}-${String(month + 1).padStart(2, '0')}`;
      const parts: [string, string][] = [[period, 'salary']];
      if (pay.paymentsPerYear === 14 && month === HOLIDAY_MONTH)
        parts.push([`${period}:holiday`, 'holiday']);
      if (pay.paymentsPerYear === 14 && month === CHRISTMAS_MONTH)
        parts.push([`${period}:christmas`, 'christmas']);

      for (const [key, part] of parts) {
        if (!paid.has(`${pay.id}|${key}`))
          due.push(entry(pay, date, key, part));
      }
    }
  }

  return due.sort(
    (a, b) =>
      a.date.localeCompare(b.date) || a.memberName.localeCompare(b.memberName),
  );
}

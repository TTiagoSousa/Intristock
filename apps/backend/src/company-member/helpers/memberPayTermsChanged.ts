import { CompanyMemberPay } from 'src/generated/prisma/client/client';
import { MemberPayData } from '../repositories/company-member-repository';

const time = (value: Date | null | undefined) => (value ? value.getTime() : null);
const num = (value: unknown) => (value === null || value === undefined ? null : Number(value));

/**
 * Se a alteração mexe no que se paga: o valor, as vezes por ano, o dia, as datas ou a
 * retenção. A descrição e o contrato não pedem um novo acordo.
 */
export function memberPayTermsChanged(current: CompanyMemberPay, data: MemberPayData) {
  const changed = <T>(next: T | undefined, before: T, same: (a: T, b: T) => boolean) =>
    next !== undefined && !same(next, before);
  const sameNum = (a: unknown, b: unknown) => num(a) === num(b);
  const sameDate = (a: Date | null, b: Date | null) => time(a) === time(b);

  return (
    changed<unknown>(data.grossAmount, current.grossAmount, sameNum) ||
    changed<unknown>(data.paymentsPerYear, current.paymentsPerYear, sameNum) ||
    changed<unknown>(data.payDay, current.payDay, sameNum) ||
    changed<unknown>(data.withholdingPct, current.withholdingPct, sameNum) ||
    changed(data.startDate, current.startDate, sameDate) ||
    changed(data.endDate, current.endDate, sameDate) ||
    changed(data.dueDate, current.dueDate, sameDate)
  );
}

import { listMemberPaymentsDue } from 'src/company-member/helpers/listMemberPaymentsDue';
import {
  IncomeCurrency,
  UserMemberPay,
} from '../repositories/personal-income-repository';
import { PrismaPersonalIncomeRepository } from '../repositories/prisma/prisma-personal-income-repository';
import { listSourceIncomesDue } from './listSourceIncomesDue';
import { PrismaTimeTrackingRepository } from 'src/time-tracking/repositories/prisma/prisma-time-tracking-repository';
import { listTimeTrackingIncomesDue } from 'src/time-tracking/helpers/listTimeTrackingIncomesDue';

const round = (value: number) => Math.round(value * 100) / 100;

export type ExpectedIncome = {
  // `source` (um salário de uma fonte), `company` (o de uma empresa da base) ou
  // `time_tracking` (as horas por pagar do banco de horas de uma empresa)
  origin: 'source' | 'company' | 'time_tracking';
  sourceId: string | null;
  memberPayId: string | null;
  period: string;
  // salary, holiday, christmas, freelance ou hours (as horas de um mês)
  part: string;
  kind: string;
  date: string;
  overdue: boolean;
  // A fonte, ou a empresa que paga
  name: string;
  company: { id: string; name: string; slug: string } | null;
  description: string | null;
  grossAmount: number | null;
  // O que se propõe como recebido: o líquido, se se souber
  amount: number;
  withholdingPct: number | null;
  currency: IncomeCurrency;
  // A empresa já registou o pagamento deste período
  companyPaid: boolean;
  // Nas horas: quantas (segundos)
  seconds?: number;
  // Horas que a empresa já pagou e a pessoa ainda não confirmou (confirma-se em /invitations)
  payoutId?: string;
};

/**
 * Os ganhos que se esperam e ainda não estão registados, entre `firstMonth` e
 * `until`: os salários fixos das fontes da pessoa e os salários e recibos
 * verdes que as empresas da base lhe pagam (ela é o membro, com a conta dela).
 * Calcula-se ao ler; registar um grava o `PersonalIncome` com o período e ele
 * sai daqui.
 */
export async function findExpectedIncomes(
  userId: string,
  firstMonth: Date,
  until: Date,
  repository: PrismaPersonalIncomeRepository,
  // As horas por pagar do banco de horas (sem ele, não entram)
  timeTracking?: PrismaTimeTrackingRepository,
): Promise<ExpectedIncome[]> {
  const now = new Date();
  const today = new Date(
    Date.UTC(now.getUTCFullYear(), now.getUTCMonth(), now.getUTCDate()),
  );
  const todayIso = today.toISOString().slice(0, 10);

  const [sources, memberPays, recorded] = await Promise.all([
    repository.findSources(userId),
    repository.findUserMemberPays(userId),
    repository.findRecordedPeriods(userId),
  ]);

  const expected: ExpectedIncome[] = listSourceIncomesDue(
    sources,
    recorded,
    firstMonth,
    until,
  ).map(({ source, period, part, date }) => ({
    origin: 'source',
    sourceId: source.id,
    memberPayId: null,
    period,
    part,
    kind: source.kind === 'client' ? 'freelance' : 'salary',
    date,
    overdue: date < todayIso,
    name: source.name,
    company: source.company,
    description: null,
    grossAmount:
      source.grossAmount === null ? null : round(Number(source.grossAmount)),
    amount: round(Number(source.netAmount ?? source.grossAmount)),
    withholdingPct: null,
    currency: source.currency as IncomeCurrency,
    companyPaid: false,
  }));

  // Os da empresa: a lista dos próximos pagamentos dela, empresa a empresa (a moeda por omissão é a de cada uma)
  const byCompany = new Map<string, UserMemberPay[]>();
  for (const pay of memberPays) {
    const list = byCompany.get(pay.member.company.id) ?? [];
    list.push(pay);
    byCompany.set(pay.member.company.id, list);
  }
  const payIds = memberPays.map((pay) => pay.id);
  const [companyPaid, lastIncomes] = await Promise.all([
    repository.findCompanyPaidPeriods(payIds),
    repository.findLastMemberPayIncomes(userId, payIds),
  ]);
  // Num salário a lista dá o bruto: o que se espera receber é o líquido. O que a empresa já
  // pagou desse período, senão o último que a pessoa recebeu desse salário (na mesma moeda),
  // e só sem nenhum dos dois o bruto
  const expectedNet = (entry: ReturnType<typeof listMemberPaymentsDue>[number]) => {
    if (entry.kind === 'freelance') return entry.netAmount;
    const currencyId = entry.currency?.id;
    const paid = companyPaid.get(`${entry.memberPayId}|${entry.period}`);
    if (paid && paid.currencyId === currencyId) return round(paid.amount);
    const last = entry.part === 'salary' ? lastIncomes.get(entry.memberPayId) : undefined;
    if (last && last.currencyId === currencyId) return round(last.amount);
    return entry.netAmount;
  };
  const payById = new Map(memberPays.map((pay) => [pay.id, pay]));

  for (const pays of byCompany.values()) {
    const company = pays[0].member.company;
    const due = listMemberPaymentsDue(
      pays,
      recorded,
      firstMonth,
      until,
      today,
      company.currency,
    );
    for (const entry of due) {
      const pay = payById.get(entry.memberPayId) as UserMemberPay;
      expected.push({
        origin: 'company',
        sourceId: null,
        memberPayId: entry.memberPayId,
        period: entry.period,
        part: entry.part,
        kind: pay.kind === 'freelance' ? 'freelance' : 'salary',
        date: entry.date,
        overdue: entry.overdue,
        name: company.name,
        company: { id: company.id, name: company.name, slug: company.slug },
        description: entry.description,
        grossAmount: entry.grossAmount,
        amount: expectedNet(entry),
        withholdingPct: entry.withholdingPct,
        currency: entry.currency as IncomeCurrency,
        companyPaid: companyPaid.has(`${entry.memberPayId}|${entry.period}`),
      });
    }
  }

  // As horas por pagar das empresas em que esta pessoa é a pessoa de uma app de horas: uma por
  // empresa e mês (quem lhe paga é a empresa, não os clientes dela); marcam-se pagas no banco de
  // horas da empresa, não aqui
  if (timeTracking) {
    const monthOf = (date: Date) => date.toISOString().slice(0, 7);
    const entries = await timeTracking.findUserEntries(userId, new Date(firstMonth.getTime() - 24 * 60 * 60 * 1000));
    for (const due of listTimeTrackingIncomesDue(entries, monthOf(firstMonth), monthOf(until))) {
      expected.push({
        origin: 'time_tracking',
        sourceId: null,
        memberPayId: null,
        period: due.period,
        part: 'hours',
        kind: 'freelance',
        date: due.date,
        overdue: due.date < todayIso,
        name: due.company.name,
        company: due.company,
        description: null,
        grossAmount: due.grossAmount,
        amount: due.netAmount,
        withholdingPct: due.withholdingPct,
        currency: due.currency as IncomeCurrency,
        companyPaid: false,
        seconds: due.seconds,
      });
    }

    // Pago pela empresa, por confirmar: aparece com o pago da empresa e o confirmar
    for (const payout of await timeTracking.findUnconfirmedPayouts(userId)) {
      const date = payout.paidAt.toISOString().slice(0, 10);
      expected.push({
        origin: 'time_tracking',
        sourceId: null,
        memberPayId: null,
        period: date.slice(0, 7),
        part: 'payout',
        kind: 'freelance',
        date,
        overdue: false,
        name: payout.company.name,
        company: payout.company,
        description: null,
        grossAmount: Number(payout.grossAmount),
        amount: Number(payout.netAmount),
        withholdingPct: payout.withholdingPct === null ? null : Number(payout.withholdingPct),
        currency: payout.currency as IncomeCurrency,
        companyPaid: true,
        seconds: payout.seconds,
        payoutId: payout.id,
      });
    }
  }

  return expected.sort(
    (a, b) => a.date.localeCompare(b.date) || a.name.localeCompare(b.name),
  );
}

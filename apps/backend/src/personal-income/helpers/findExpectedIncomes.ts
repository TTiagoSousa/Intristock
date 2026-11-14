import { listMemberPaymentsDue } from 'src/company-member/helpers/listMemberPaymentsDue';
import {
  IncomeCurrency,
  UserMemberPay,
} from '../repositories/personal-income-repository';
import { PrismaPersonalIncomeRepository } from '../repositories/prisma/prisma-personal-income-repository';
import { listSourceIncomesDue } from './listSourceIncomesDue';

const round = (value: number) => Math.round(value * 100) / 100;

export type ExpectedIncome = {
  // `source` (um salário de uma fonte) ou `company` (o de uma empresa da base)
  origin: 'source' | 'company';
  sourceId: string | null;
  memberPayId: string | null;
  period: string;
  // salary, holiday, christmas ou freelance
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
  const companyPaid = await repository.findCompanyPaidPeriods(
    memberPays.map((pay) => pay.id),
  );
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
        amount: entry.netAmount,
        withholdingPct: entry.withholdingPct,
        currency: entry.currency as IncomeCurrency,
        companyPaid: companyPaid.has(`${entry.memberPayId}|${entry.period}`),
      });
    }
  }

  return expected.sort(
    (a, b) => a.date.localeCompare(b.date) || a.name.localeCompare(b.name),
  );
}

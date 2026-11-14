import { useState } from 'react';
import { useNavigate, useParams } from 'react-router-dom';
import { useTranslation } from 'react-i18next';
import http from '../../../../Service/httpService';
import { End_Points } from '../../../../Service/endPoints';
import { useCompany } from '../../../../Contexts/Company_Context';
import { useAlert } from '../../../../Contexts/Alert_Context';
import { useBreadcrumbSegmentLabel } from '../../../../Contexts/Breadcrumb_Context';
import { getErrorMessage } from '../../../../Hooks/useAsyncRequest';
import { useCurrencyFormat } from '../../../../Hooks/useCurrencyFormat';
import { useCompanyBankAccounts } from '../../../../Hooks/Companies/useCompanyBankAccounts';
import { useUpcomingPayments, type Upcoming_Payment } from '../../../../Hooks/Companies/useUpcomingPayments';
import Record_Member_Payment_Popover, { type Member_Payment_Input } from './Record_Member_Payment_Popover';
import './Company_Upcoming_Payments.scss';

// Os períodos que se escolhem, em meses para a frente
const PERIODS = [1, 3, 6, 12];

/**
 * Os próximos pagamentos aos membros: os salários de cada mês (e os subsídios
 * de quem recebe 14 vezes) e os recibos verdes por pagar, com os em atraso dos
 * últimos meses no topo. Calculados no backend; registar um cria o pagamento
 * ligado a ele, e ele sai da lista.
 */
const Company_Upcoming_Payments = () => {
  const { slug } = useParams();
  const { t, i18n } = useTranslation();
  const navigate = useNavigate();
  const { company, can, loading: loadingCompany } = useCompany();
  const { setAlert } = useAlert();
  const { formatIn } = useCurrencyFormat();
  const [months, setMonths] = useState(3);
  const { data, error, reload } = useUpcomingPayments(company?.id, months);
  const { bankAccounts } = useCompanyBankAccounts(company?.id);
  const [recording, setRecording] = useState<Upcoming_Payment | null>(null);
  const [saving, setSaving] = useState(false);

  useBreadcrumbSegmentLabel(slug, company?.name);

  if (loadingCompany || !company) {
    return (
      <div className="Company_Upcoming">
        <span className="Upcoming_Message">{loadingCompany ? t('common.loading') : t('companies.notFound')}</span>
      </div>
    );
  }

  const locale = i18n.language === 'pt' ? 'pt-PT' : 'en-GB';
  const date = (value: string) =>
    new Date(`${value}T00:00:00Z`).toLocaleDateString(locale, { day: '2-digit', month: 'short', year: 'numeric', timeZone: 'UTC' });
  const monthName = (period: string) =>
    new Date(`${period.slice(0, 7)}-01T00:00:00Z`).toLocaleDateString(locale, { month: 'long', timeZone: 'UTC' });

  // "Salário de novembro", "Subsídio de Natal", "Recibo verde"
  const labelOf = (payment: Upcoming_Payment) =>
    payment.part === 'salary'
      ? t('upcomingPayments.part_salary', { month: monthName(payment.period) })
      : t(`upcomingPayments.part_${payment.part}`);

  const totals = (data ?? []).reduce<Record<string, number>>((sum, payment) => {
    const value = payment.kind === 'freelance' ? payment.netAmount : payment.grossAmount;
    sum[payment.currency.shortCode] = (sum[payment.currency.shortCode] ?? 0) + value;
    return sum;
  }, {});
  const overdue = (data ?? []).filter((payment) => payment.overdue).length;

  const record = async (payment: Upcoming_Payment, input: Member_Payment_Input) => {
    setSaving(true);
    try {
      await http.post(End_Points.Company_Payments_Endpoint(company.id), {
        paymentType: 'pay',
        partyType: 'member',
        memberId: payment.memberId,
        memberPayId: payment.memberPayId,
        memberPayPeriod: payment.period,
        fromBankAccountId: input.fromBankAccountId,
        amount: input.amount,
        currencyId: payment.currency.id,
        paymentDate: input.paymentDate,
        ...(input.description ? { description: input.description } : {}),
      });
      setAlert({ open: true, message: t('upcomingPayments.recorded'), type: 'success' });
      setRecording(null);
      reload();
    } catch (reason) {
      setAlert({ open: true, message: getErrorMessage(reason), type: 'error' });
    } finally {
      setSaving(false);
    }
  };

  return (
    <div className="Company_Upcoming">
      <div className="Card Upcoming_Card">
        <div className="Card_Header">
          <div className="Card_Header_Text">
            <span className="Card_Title">{t('upcomingPayments.title')}</span>
            <span className="Card_Subtitle">
              {data && data.length > 0
                ? t('upcomingPayments.summary', {
                    count: data.length,
                    total: Object.entries(totals)
                      .map(([code, value]) => formatIn(value, code))
                      .join(' + '),
                  }) + (overdue > 0 ? ` · ${t('upcomingPayments.overdueCount', { count: overdue })}` : '')
                : t('upcomingPayments.subtitle')}
            </span>
          </div>
          <div className="Upcoming_Controls">
            <div className="Tabs">
              {PERIODS.map((period) => (
                <button
                  key={period}
                  type="button"
                  className={months === period ? 'Active' : ''}
                  onClick={() => setMonths(period)}
                >
                  {t('purchasesDashboard.months', { count: period })}
                </button>
              ))}
            </div>
          </div>
        </div>

        <div className="Upcoming_Body">
          {error ? (
            <span className="Upcoming_Message Bad">{error}</span>
          ) : !data ? (
            <span className="Upcoming_Message">{t('common.loading')}</span>
          ) : data.length === 0 ? (
            <div className="Empty_State">
              <span className="Empty_State_Title">{t('upcomingPayments.empty')}</span>
              <span className="Empty_State_Text">{t('upcomingPayments.emptyHint')}</span>
            </div>
          ) : (
            <div className="Table_Wrap">
              <table className="Table">
                <thead>
                  <tr>
                    <th>{t('upcomingPayments.date')}</th>
                    <th>{t('upcomingPayments.member')}</th>
                    <th>{t('upcomingPayments.what')}</th>
                    <th className="Right">{t('upcomingPayments.gross')}</th>
                    <th className="Right">{t('upcomingPayments.toPay')}</th>
                    <th className="Col_Actions" />
                  </tr>
                </thead>
                <tbody>
                  {data.map((payment) => (
                    <tr key={`${payment.memberPayId}|${payment.period}`}>
                      <td className="Num">
                        {date(payment.date)}
                        {payment.overdue && <span className="Pill Bad Upcoming_Pill">{t('upcomingPayments.overdue')}</span>}
                      </td>
                      <td>
                        <button
                          type="button"
                          className="Upcoming_Member"
                          onClick={() => navigate(`/Companies/${company.slug}/membros/pessoa/${payment.memberId}`)}
                        >
                          {payment.memberName}
                        </button>
                      </td>
                      <td>
                        {labelOf(payment)}
                        {payment.description && <div className="Upcoming_Sub">{payment.description}</div>}
                      </td>
                      <td className="Right Num">{formatIn(payment.grossAmount, payment.currency.shortCode)}</td>
                      <td className="Right Num">
                        {payment.kind === 'freelance' ? (
                          <>
                            {formatIn(payment.netAmount, payment.currency.shortCode)}
                            {payment.withholdingPct ? (
                              <div className="Upcoming_Sub">
                                {t('upcomingPayments.withholding', { pct: payment.withholdingPct })}
                              </div>
                            ) : null}
                          </>
                        ) : (
                          <span className="Upcoming_Sub">{t('upcomingPayments.netOnRecord')}</span>
                        )}
                      </td>
                      <td className="Right">
                        {can('payments.create') && (
                          <button type="button" className="Upcoming_Record" onClick={() => setRecording(payment)}>
                            {t('upcomingPayments.record')}
                          </button>
                        )}
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          )}
        </div>
      </div>

      {recording && (
        <Record_Member_Payment_Popover
          payment={recording}
          label={labelOf(recording)}
          bankAccounts={bankAccounts}
          companyCurrencyId={company.currencyId}
          saving={saving}
          onClose={() => setRecording(null)}
          onConfirm={(input) => record(recording, input)}
        />
      )}
    </div>
  );
};

export default Company_Upcoming_Payments;

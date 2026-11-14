import { useEffect, useState } from 'react';
import { useLocation, useNavigate, useParams } from 'react-router-dom';
import { useTranslation } from 'react-i18next';
import { useCompanies } from '../../../../Hooks/Companies/useCompanies';
import { useCompanyPayments } from '../../../../Hooks/Companies/useCompanyPayments';
import { uploadPaymentDocument } from '../../../../Hooks/Companies/useCompanyPaymentDocuments';
import { useBreadcrumbSegmentLabel } from '../../../../Contexts/Breadcrumb_Context';
import { useAlert } from '../../../../Contexts/Alert_Context';
import Simple_Button from '../../../../Components/Buttons/Simple_Button/Simple_Button';
import Global_Pagination from '../../../../Components/Pagination/Global_Pagination/Global_Pagination';
import Payment_Form_Popover from './Payment_Form_Popover';
import Payment_Details_Popover from './Payment_Details_Popover';
import Delete_Payment_Popover from './Delete_Payment_Popover';
import type { New_Supplier_Result } from '../Company_Suppliers/Company_Supplier';
import type { New_Item_Result } from '../Company_Items/Company_Item';
import type { CompanyPayment } from '../../../../Hooks/Companies/useCompanyPayments';
import * as Icon from '../../../../Imports/icons';
import { useCompany } from '../../../../Contexts/Company_Context';
import './Company_Payments.scss';

const Company_Payments = () => {
  const { slug } = useParams();
  const { companies, loading: loadingCompanies } = useCompanies();
  const { can } = useCompany();
  const { t, i18n } = useTranslation();
  const { setAlert } = useAlert();
  const location = useLocation();
  const navigate = useNavigate();
  // De volta da página "Novo fornecedor" ou "Novo item": o formulário abre
  // sozinho com o fornecedor escolhido ou uma linha com o item. O estado da
  // navegação é limpo logo a seguir, para um refresh não o voltar a abrir.
  const [returned, setReturned] = useState(
    () => (location.state ?? {}) as Partial<New_Supplier_Result & New_Item_Result>,
  );
  const [isFormOpen, setIsFormOpen] = useState(
    Boolean(returned.newSupplierId || returned.newItemId),
  );

  useEffect(() => {
    if (returned.newSupplierId || returned.newItemId) {
      navigate(location.pathname, { replace: true, state: null });
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);
  const [paymentToView, setPaymentToView] = useState<CompanyPayment | null>(null);
  const [paymentToDelete, setPaymentToDelete] = useState<CompanyPayment | null>(null);

  const company = companies.find((item) => item.slug === slug);

  useBreadcrumbSegmentLabel(slug, company?.name);

  const {
    payments,
    total: totalPayments,
    page,
    setPage,
    totalPages,
    pageSize,
    loading: loadingPayments,
    loadingPage,
    refresh,
    createPayment,
    updatePayment,
    deletePayment,
  } = useCompanyPayments(company?.id);

  // O valor chega como string (Decimal do Prisma) e a moeda pode não existir
  const formatAmount = (payment: CompanyPayment) => {
    const value = Number(payment.amount);

    if (Number.isNaN(value)) return '—';

    const formatted = value.toLocaleString(i18n.language, {
      minimumFractionDigits: 2,
      maximumFractionDigits: 2,
    });

    return payment.currency ? `${formatted} ${payment.currency.symbol}` : formatted;
  };

  // Noutra moeda, o valor na da empresa: o que conta nos totais. É o `amount`
  // à taxa que o pagamento guardou.
  const formatCompanyAmount = (payment: CompanyPayment) => {
    if (!company || payment.currencyId === company.currencyId) return null;

    const value = Math.round(Number(payment.amount) * Number(payment.exchangeRate) * 100) / 100;

    if (Number.isNaN(value)) return null;

    return `${value.toLocaleString(i18n.language, {
      minimumFractionDigits: 2,
      maximumFractionDigits: 2,
    })} ${company.currency.symbol}`;
  };

  const formatDate = (value: string) => new Date(value).toLocaleDateString(i18n.language);

  // Num pagamento a fornecedor ou a um membro mostra-se o nome; nos outros, só o tipo de parte
  const formatCounterparty = (payment: CompanyPayment) =>
    payment.partyType === 'supplier'
      ? (payment.supplier?.name ?? '—')
      : payment.partyType === 'member'
        ? (payment.member?.name ?? payment.member?.user?.fullName ?? '—')
        : t(`payments.party_${payment.partyType}`);

  if (loadingCompanies) {
    return (
      <div className="Company_Payments">
        <span className="Company_Payments_Message">{t('common.loading')}</span>
      </div>
    );
  }

  if (!company) {
    return (
      <div className="Company_Payments">
        <span className="Company_Payments_Message">{t('companies.notFound')}</span>
      </div>
    );
  }

  return (
    <div className="Company_Payments">
      <div className="Payments_Card">
        <div className="Card_Header">
          <div className="Card_Header_Text">
            <span className="Card_Title">{t('payments.title')}</span>
            <span className="Card_Subtitle">{company.name}</span>
          </div>

          <div className="Card_Header_Action">
            {can('payments.create') && (
              <Simple_Button text={t('payments.addPayment')} onClick={() => {
                  setReturned({});
                  setIsFormOpen(true);
                }} />
            )}
          </div>
        </div>

        <div className="Payments_Body">
          {loadingPayments ? (
            <span className="Company_Payments_Message">{t('common.loading')}</span>
          ) : totalPayments === 0 ? (
            <span className="Company_Payments_Message">{t('payments.empty')}</span>
          ) : (
            <>
              {/* Ao mudar de bloco as linhas anteriores ficam à vista, só mais
                  apagadas — a tabela não muda de tamanho nem pisca */}
              <div className={`Payments_Table_Scroll ${loadingPage ? 'Loading' : ''}`}>
                <table className="Payments_Table">
                  <thead>
                    <tr>
                      <th>{t('payments.columnDate')}</th>
                      <th>{t('payments.columnType')}</th>
                      <th>{t('payments.columnSupplier')}</th>
                      <th>{t('payments.columnAmount')}</th>
                      <th>{t('payments.columnLines')}</th>
                      <th>{t('payments.columnStatus')}</th>
                      <th></th>
                    </tr>
                  </thead>
                  <tbody>
                    {payments.map((payment) => (
                      <tr
                        key={payment.id}
                        className="Payment_Row"
                        onClick={() => setPaymentToView(payment)}
                      >
                        <td>{formatDate(payment.paymentDate)}</td>
                        <td>{t(`payments.type_${payment.paymentType}`)}</td>
                        <td className="Payment_Party">
                          {formatCounterparty(payment)}
                          {payment.reference && (
                            <span className="Payment_Reference">{payment.reference}</span>
                          )}
                        </td>
                        <td>
                          {formatAmount(payment)}
                          {formatCompanyAmount(payment) && (
                            <span className="Payment_Converted">
                              ≈ {formatCompanyAmount(payment)}
                            </span>
                          )}
                        </td>
                        <td>
                          {payment.items.length > 0
                            ? t('payments.linesCount', { count: payment.items.length })
                            : '—'}
                        </td>
                        <td>
                          <span className={`Payment_Status ${payment.status}`}>
                            {t(`payments.status_${payment.status}`)}
                          </span>
                        </td>
                        <td className="Right">
                          <div className="Payment_Actions">
                            {can('payments.delete') && (
                              <button
                                type="button"
                                className="Row_Action Danger"
                                // A linha inteira abre o detalhe — sem isto, apagar
                                // abria as duas coisas ao mesmo tempo
                                onClick={(e) => {
                                  e.stopPropagation();
                                  setPaymentToDelete(payment);
                                }}
                                title={t('common.delete')}
                                aria-label={t('common.delete')}
                              >
                                <Icon.Trash />
                              </button>
                            )}
                          </div>
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>

              <Global_Pagination
                page={page}
                totalPages={totalPages}
                onPageChange={setPage}
                totalItems={totalPayments}
                pageSize={pageSize}
              />
            </>
          )}
        </div>
      </div>

      {isFormOpen && (
        <Payment_Form_Popover
          companyId={company.id}
          companyName={company.name}
          companyCountryId={company.countryId}
          companyCurrencyId={company.currencyId}
          initialSupplierId={returned.newSupplierId}
          initialItemId={returned.newItemId}
          onClose={() => setIsFormOpen(false)}
          onSubmit={async (payload, files) => {
            const created = await createPayment(payload);

            if (!created) return;

            // Os ficheiros só sobem depois de o pagamento existir. Se algum
            // falhar, o pagamento fica na mesma — dizemos quais é que faltaram
            // para poderem ser anexados pelo detalhe.
            const failed: string[] = [];

            for (const file of files) {
              try {
                await uploadPaymentDocument(company.id, created.id, file);
              } catch {
                failed.push(file.name);
              }
            }

            if (failed.length > 0) {
              setAlert({
                open: true,
                message: t('documents.uploadFailed', { names: failed.join(', ') }),
                type: 'error',
              });
            }

            setIsFormOpen(false);
            await refresh();
          }}
        />
      )}

      {paymentToView && (
        <Payment_Details_Popover
          companyId={company.id}
          companyCurrency={company.currency}
          payment={paymentToView}
          onClose={() => setPaymentToView(null)}
          onUpdate={async (payload) => {
            const updated = await updatePayment(paymentToView.id, payload);

            // A resposta não traz as relações (fornecedor, itens…): ficam as
            // que já estavam à vista, com a taxa nova
            if (updated) {
              setPaymentToView({
                ...paymentToView,
                exchangeRate: updated.exchangeRate,
                rateSource: updated.rateSource,
              });
            }

            return Boolean(updated);
          }}
        />
      )}

      {paymentToDelete && (
        <Delete_Payment_Popover
          paymentLabel={`${formatDate(paymentToDelete.paymentDate)} · ${formatAmount(paymentToDelete)} · ${formatCounterparty(paymentToDelete)}`}
          onClose={() => setPaymentToDelete(null)}
          onConfirm={async () => {
            const deleted = await deletePayment(paymentToDelete.id);

            if (deleted) setPaymentToDelete(null);
          }}
        />
      )}
    </div>
  );
};

export default Company_Payments;

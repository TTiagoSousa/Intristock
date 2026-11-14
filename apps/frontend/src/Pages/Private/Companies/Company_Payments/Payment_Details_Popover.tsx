import { useEffect, useState } from 'react';
import { useTranslation } from 'react-i18next';
import type {
  CompanyPayment,
  CompanyPaymentUpdatePayload,
} from '../../../../Hooks/Companies/useCompanyPayments';
import { useCompany } from '../../../../Contexts/Company_Context';
import Simple_Button from '../../../../Components/Buttons/Simple_Button/Simple_Button';
import Global_Input from '../../../../Components/Inputs/Global_Input/Global_Input';
import Payment_Documents from './Payment_Documents';

interface Payment_Details_Popover_Props {
  companyId: string;
  // Noutra moeda, mostra-se e corrige-se o valor nesta
  companyCurrency: { id: string; shortCode: string; symbol: string };
  payment: CompanyPayment;
  onClose: () => void;
  // Corrigir o valor na moeda da empresa; diz se ficou gravado
  onUpdate: (payload: CompanyPaymentUpdatePayload) => Promise<boolean>;
}

// O estado do pagamento nas cores semânticas das primitivas, para se ler à
// distância em vez de ser mais uma linha de texto igual às outras
const STATUS_TONE: Record<string, string> = {
  completed: 'Ok',
  cancelled: 'Bad',
  draft: 'Warn',
};

const Payment_Details_Popover = ({
  companyId,
  companyCurrency,
  payment,
  onClose,
  onUpdate,
}: Payment_Details_Popover_Props) => {
  const { t, i18n } = useTranslation();
  const { can } = useCompany();
  // O valor na moeda da empresa em edição (o do extrato); null = só a ver
  const [companyDraft, setCompanyDraft] = useState<string | null>(null);
  const [saving, setSaving] = useState(false);

  useEffect(() => {
    const handleEscape = (e: KeyboardEvent) => {
      if (e.key === 'Escape') onClose();
    };

    document.addEventListener('keydown', handleEscape);
    return () => document.removeEventListener('keydown', handleEscape);
  }, [onClose]);

  const toNumber = (value: string | null) => {
    if (value === null || value === '') return null;

    const parsed = Number(value);

    return Number.isNaN(parsed) ? null : parsed;
  };

  // Tudo o que é dinheiro chega como string (Decimal do Prisma)
  const formatMoney = (value: string | number | null) => {
    const parsed = typeof value === 'number' ? value : toNumber(value);

    if (parsed === null) return '—';

    const formatted = parsed.toLocaleString(i18n.language, {
      minimumFractionDigits: 2,
      maximumFractionDigits: 2,
    });

    return payment.currency ? `${formatted} ${payment.currency.symbol}` : formatted;
  };

  const formatQuantity = (value: string) => {
    const parsed = Number(value);

    return Number.isNaN(parsed) ? value : parsed.toLocaleString(i18n.language);
  };

  const formatDate = (value: string) =>
    new Date(value).toLocaleDateString(i18n.language, {
      day: '2-digit',
      month: 'long',
      year: 'numeric',
    });

  const counterparty =
    payment.partyType === 'supplier'
      ? (payment.supplier?.name ?? t(`payments.party_${payment.partyType}`))
      : t(`payments.party_${payment.partyType}`);

  // O que a fatura leva de imposto, e o que sobra como base. O total é o que
  // saiu do banco; a base tira-se dele, não das linhas, para bater sempre certo
  // mesmo num pagamento sem itens discriminados.
  const taxTotal = payment.taxes.reduce((sum, line) => sum + (toNumber(line.taxAmount) ?? 0), 0);
  const total = toNumber(payment.amount) ?? 0;
  const baseAmount = total - taxTotal;

  // Noutra moeda: o que o pagamento vale na da empresa, à taxa que guardou
  const isForeign = payment.currencyId !== companyCurrency.id;
  const exchangeRate = Number(payment.exchangeRate);
  const companyTotal = Math.round(total * exchangeRate * 100) / 100;

  const formatCompany = (value: number) =>
    `${value.toLocaleString(i18n.language, {
      minimumFractionDigits: 2,
      maximumFractionDigits: 2,
    })} ${companyCurrency.symbol}`;

  const saveCompanyAmount = async (payload: CompanyPaymentUpdatePayload) => {
    setSaving(true);
    const saved = await onUpdate(payload);
    setSaving(false);

    if (saved) setCompanyDraft(null);
  };

  const draftValue = companyDraft === null ? NaN : Number(companyDraft);
  const draftValid = companyDraft !== null && companyDraft.trim() !== '' && draftValue > 0;

  // Só se mostra o que existe: uma grelha cheia de traços não diz nada e só
  // afasta o que interessa
  const details = [
    { key: 'type', label: t('payments.columnType'), value: t(`payments.type_${payment.paymentType}`) },
    { key: 'party', label: t('payments.columnSupplier'), value: counterparty },
    { key: 'from', label: t('payments.fromAccount'), value: payment.fromBankAccount?.name },
    { key: 'to', label: t('payments.toAccount'), value: payment.toBankAccount?.name },
    { key: 'reference', label: t('payments.reference'), value: payment.reference },
  ].filter((detail) => Boolean(detail.value));

  return (
    <div className="Popover_Backdrop" onClick={onClose}>
      <div className="Popover_Card" onClick={(e) => e.stopPropagation()}>
        <div className="Popover_Header">
          <div className="Popover_Header_Text">
            <span className="Popover_Title">{t('payments.detailsTitle')}</span>
            <span className="Popover_Subtitle">{formatDate(payment.paymentDate)}</span>
          </div>

          <button
            type="button"
            className="Popover_Close"
            onClick={onClose}
            aria-label={t('common.close')}
          >
            ×
          </button>
        </div>

        <div className="Popover_Body">
          {/* O valor é a razão de se abrir isto — vem primeiro e sozinho */}
          <div className="Detail_Hero">
            <div className="Detail_Hero_Main">
              <span className="Detail_Hero_Amount">{formatMoney(payment.amount)}</span>
              <span className={`Pill ${STATUS_TONE[payment.status] ?? ''}`}>
                <span className="Dot" />
                {t(`payments.status_${payment.status}`)}
              </span>
            </div>
            <span className="Detail_Hero_Meta">{counterparty}</span>
          </div>

          <div className="Detail_Grid">
            {details.map((detail) => (
              <div className="Detail" key={detail.key}>
                <span className="Detail_Label">{detail.label}</span>
                <span className="Detail_Value">{detail.value}</span>
              </div>
            ))}
          </div>

          {payment.description && (
            <div className="Detail_Note">
              <span className="Detail_Label">{t('payments.description')}</span>
              <p>{payment.description}</p>
            </div>
          )}

          <div className="Detail_Section">
            <span className="Detail_Section_Title">{t('payments.linesTitle')}</span>

            {payment.items.length === 0 ? (
              <span className="Lines_Empty">{t('payments.noLinesRecorded')}</span>
            ) : (
              <div className="Table_Wrap">
                <table className="Table">
                  <thead>
                    <tr>
                      <th>{t('payments.item')}</th>
                      <th className="Right">{t('payments.quantity')}</th>
                      <th className="Right">{t('payments.unitPrice')}</th>
                      <th className="Right">{t('payments.lineTotal')}</th>
                    </tr>
                  </thead>
                  <tbody>
                    {payment.items.map((line) => (
                      <tr key={line.id}>
                        <td>{line.item?.name ?? '—'}</td>
                        <td className="Right Num">
                          {formatQuantity(line.quantity)}
                          {line.item?.unit ? ` ${line.item.unit}` : ''}
                        </td>
                        <td className="Right Num">{formatMoney(line.unitPrice)}</td>
                        <td className="Right Num Strong">{formatMoney(line.totalPrice)}</td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            )}
          </div>

          {payment.taxes.length > 0 && (
            <div className="Detail_Section">
              <span className="Detail_Section_Title">{t('payments.taxesTitle')}</span>

              <div className="Table_Wrap">
                <table className="Table">
                  <thead>
                    <tr>
                      <th>{t('payments.tax')}</th>
                      <th className="Right">{t('payments.rate')}</th>
                      <th className="Right">{t('payments.taxBase')}</th>
                      <th className="Right">{t('payments.taxAmount')}</th>
                    </tr>
                  </thead>
                  <tbody>
                    {payment.taxes.map((line) => (
                      <tr key={line.id}>
                        <td>{line.tax?.name ?? '—'}</td>
                        <td className="Right Num">{line.rate}%</td>
                        <td className="Right Num">{formatMoney(line.netAmount)}</td>
                        <td className="Right Num Strong">{formatMoney(line.taxAmount)}</td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            </div>
          )}

          {/* Como se fecha a conta: base, impostos, e o que saiu do banco.
              Reaproveita o mesmo bloco de totais do formulário de criação. */}
          <div className="Amount_Summary">
            <div className="Amount_Row">
              <span>{t('payments.baseAmount')}</span>
              <span>{formatMoney(baseAmount)}</span>
            </div>
            {taxTotal > 0 && (
              <div className="Amount_Row">
                <span>{t('payments.taxTotal')}</span>
                <span>{formatMoney(taxTotal)}</span>
              </div>
            )}
            <div className="Amount_Row Total">
              <span>{t('payments.summaryTotal')}</span>
              <span>{formatMoney(total)}</span>
            </div>
          </div>

          {/* Noutra moeda: quanto saiu na moeda da empresa. Fica fixo com a
              taxa do dia em que foi gravado; corrige-se aqui com o valor do
              extrato, e o stock e os ativos da compra acompanham. */}
          {isForeign && (
            <div className="Detail_Section">
              <span className="Detail_Section_Title">
                {t('payments.companyAmount', { code: companyCurrency.shortCode })}
              </span>

              <div className="Amount_Summary">
                <div className="Amount_Row Total">
                  <span>
                    {payment.rateSource === 'manual'
                      ? t('payments.rateSource_manual')
                      : t('payments.rateSource_market', {
                          date: new Date(payment.paymentDate).toLocaleDateString(i18n.language),
                        })}
                  </span>
                  <span>{formatCompany(companyTotal)}</span>
                </div>
                <span className="Amount_Hint">
                  {t('payments.rateLine', {
                    from: payment.currency?.shortCode ?? '',
                    rate: exchangeRate.toLocaleString(i18n.language, { maximumFractionDigits: 6 }),
                    to: companyCurrency.shortCode,
                  })}
                </span>

                {!can('payments.edit') ? null : companyDraft === null ? (
                  <div className="Rate_Actions">
                    <Simple_Button
                      text={t('payments.editCompanyAmount')}
                      variant="Ghost"
                      small
                      auto
                      onClick={() => setCompanyDraft(companyTotal.toFixed(2))}
                    />
                    {payment.rateSource === 'manual' && (
                      <Simple_Button
                        text={t('payments.rateUseMarket')}
                        variant="Quiet"
                        small
                        auto
                        disabled={saving}
                        onClick={() => saveCompanyAmount({ useMarketRate: true })}
                      />
                    )}
                  </div>
                ) : (
                  <div className="Rate_Actions">
                    <div className="Rate_Input">
                      <Global_Input
                        type="number"
                        value={companyDraft}
                        onChange={(e) => setCompanyDraft(e.target.value)}
                      />
                    </div>
                    <Simple_Button
                      text={saving ? t('common.saving') : t('common.save')}
                      small
                      auto
                      disabled={saving || !draftValid}
                      onClick={() => saveCompanyAmount({ companyAmount: draftValue })}
                    />
                    <Simple_Button
                      text={t('common.cancel')}
                      variant="Quiet"
                      small
                      auto
                      disabled={saving}
                      onClick={() => setCompanyDraft(null)}
                    />
                  </div>
                )}
              </div>
            </div>
          )}

          <Payment_Documents companyId={companyId} paymentId={payment.id} />
        </div>

        <div className="Popover_Footer">
          <div className="Form_Action">
            <Simple_Button text={t('common.close')} onClick={onClose} />
          </div>
        </div>
      </div>
    </div>
  );
};

export default Payment_Details_Popover;

import { useEffect, useRef, useState } from 'react';
import { useLocation, useNavigate, useParams } from 'react-router-dom';
import { useTranslation } from 'react-i18next';
import { useCompanySupplierOptions } from '../../../../Hooks/Companies/useCompanyOptions';
import { usePaymentMemberOptions } from '../../../../Hooks/Companies/usePaymentMemberOptions';
import type { Upcoming_Payment } from '../../../../Hooks/Companies/useUpcomingPayments';
import { useCompanyBankAccounts } from '../../../../Hooks/Companies/useCompanyBankAccounts';
import { useCompanyItemOptions } from '../../../../Hooks/Companies/useCompanyOptions';
import { useTaxes } from '../../../../Hooks/Companies/useTaxes';
import { useExchangeRate } from '../../../../Hooks/Companies/useExchangeRate';
import { useCurrency } from '../../../../Contexts/Currency_Context';
import { useAlert } from '../../../../Contexts/Alert_Context';
import type {
  CompanyPaymentPayload,
  PartyType,
  PaymentStatus,
  PaymentType,
} from '../../../../Hooks/Companies/useCompanyPayments';
import Global_Input from '../../../../Components/Inputs/Global_Input/Global_Input';
import Global_Dropdown from '../../../../Components/Inputs/Global_Dropdown/Global_Dropdown';
import Simple_Button from '../../../../Components/Buttons/Simple_Button/Simple_Button';
import * as Icon from '../../../../Imports/icons';
import type { New_Supplier_State } from '../Company_Suppliers/Company_Supplier';
import type { New_Item_State } from '../Company_Items/Company_Item';

// Linha em edição: os valores ficam string enquanto se escreve e só são
// convertidos no submit
interface Draft_Line {
  // Chave estável da linha — o itemId não serve, pode estar vazio ou repetido
  key: string;
  itemId: string;
  quantity: string;
  unitPrice: string;
}

interface Payment_Form_Popover_Props {
  companyId: string;
  companyName: string;
  // O catálogo de impostos é por país — sem ele mostram-se os de todos
  companyCountryId: string | null;
  // A moeda da empresa: o pagamento nasce nela, e noutra moeda mostra-se
  // também o valor nela
  companyCurrencyId: string;
  // Fornecedor acabado de criar na página "Novo fornecedor" — o formulário
  // reabre com ele já escolhido
  initialSupplierId?: string;
  // Item acabado de criar na página "Novo item" — o formulário reabre com uma
  // linha já com ele
  initialItemId?: string;
  onClose: () => void;
  // Os ficheiros seguem à parte: só podem ser enviados depois de o pagamento
  // existir, porque é a ele que ficam agarrados
  onSubmit: (payload: CompanyPaymentPayload, files: File[]) => Promise<void>;
}

// KB até 1 MB, depois MB — números com sete dígitos não dizem nada a ninguém
const formatSize = (bytes: number) => {
  if (bytes < 1024) return `${bytes} B`;
  if (bytes < 1024 * 1024) return `${Math.round(bytes / 1024)} KB`;

  return `${(bytes / 1024 / 1024).toFixed(1)} MB`;
};

// Contador em vez de crypto.randomUUID: esse só existe em https ou localhost,
// e a VM abre-se em http pelo IP
let lineSeq = 0;

const emptyLine = (): Draft_Line => ({
  key: `line-${++lineSeq}`,
  itemId: '',
  quantity: '1',
  unitPrice: '',
});

// Dinheiro com 2 casas: quantidade × preço em floats deixa restos
const roundMoney = (value: number) => Math.round(value * 100) / 100;

const Payment_Form_Popover = ({
  companyId,
  companyName,
  companyCountryId,
  companyCurrencyId,
  initialSupplierId,
  initialItemId,
  onClose,
  onSubmit,
}: Payment_Form_Popover_Props) => {
  const { t, i18n } = useTranslation();
  const { slug } = useParams();
  const navigate = useNavigate();
  const location = useLocation();
  const { setAlert } = useAlert();

  const { suppliers, loading: loadingSuppliers } = useCompanySupplierOptions(companyId);
  const [partyType, setPartyType] = useState<PartyType>('supplier');
  const { members, upcoming } = usePaymentMemberOptions(partyType === 'member' ? companyId : undefined);
  const { bankAccounts, loading: loadingBankAccounts } = useCompanyBankAccounts(companyId);
  const { items, loading: loadingItems } = useCompanyItemOptions(companyId);
  const { taxes, loading: loadingTaxes } = useTaxes(companyCountryId);
  const { currencies } = useCurrency();

  const [paymentType, setPaymentType] = useState<PaymentType>('pay');
  const [supplierId, setSupplierId] = useState(initialSupplierId ?? '');
  const [fromBankAccountId, setFromBankAccountId] = useState('');
  const [toBankAccountId, setToBankAccountId] = useState('');
  const [memberId, setMemberId] = useState('');
  // O salário/recibo e o período que se paga (`payId|período`); vazio = pagamento avulso
  const [memberPayKey, setMemberPayKey] = useState('');
  const [currencyId, setCurrencyId] = useState(companyCurrencyId);
  // Noutra moeda: o valor na da empresa escrito à mão (o que o banco cobrou).
  // Vazio, vale a cotação do dia.
  const [companyAmount, setCompanyAmount] = useState('');
  // Hoje por defeito, no formato que o input date espera
  const [paymentDate, setPaymentDate] = useState(new Date().toISOString().slice(0, 10));
  const [status, setStatus] = useState<PaymentStatus>('completed');
  const [reference, setReference] = useState('');
  const [description, setDescription] = useState('');
  const [amount, setAmount] = useState('');
  const [lines, setLines] = useState<Draft_Line[]>(() =>
    initialItemId ? [{ ...emptyLine(), itemId: initialItemId }] : [],
  );
  // Impostos aplicados, por ordem de escolha — só os ids, os valores vêm do backend
  const [selectedTaxIds, setSelectedTaxIds] = useState<string[]>([]);
  // Preços escritos já com imposto lá dentro (a fatura diz 123 € com IVA)
  const [pricesIncludeTax, setPricesIncludeTax] = useState(false);
  // A que propriedade o custo pertence, e a que período — a torneira pode ter
  // sido arranjada em julho e só paga em novembro
  // Ficheiros escolhidos, ainda por enviar — só sobem depois de gravar
  const [files, setFiles] = useState<File[]>([]);
  const fileInputRef = useRef<HTMLInputElement>(null);
  const [saving, setSaving] = useState(false);

  useEffect(() => {
    const handleEscape = (e: KeyboardEvent) => {
      if (e.key === 'Escape') onClose();
    };

    document.addEventListener('keydown', handleEscape);
    return () => document.removeEventListener('keydown', handleEscape);
  }, [onClose]);

  // Só itens ativos: um item desativado não deve entrar em compras novas
  const activeItems = items.filter((item) => item.isActive);

  // Com um fornecedor escolhido, os itens que ele vende vêm primeiro e os
  // outros depois de uma divisória — compra-se quase sempre o que ele vende,
  // mas às vezes não, e não vale a pena ir ligá-lo antes
  const selectedSupplierId = partyType === 'supplier' ? supplierId : '';
  const itemLabel = (item: (typeof activeItems)[number]) =>
    item.unit ? `${item.name} (${t(`items.unit_${item.unit}`)})` : item.name;
  const supplierItems = selectedSupplierId
    ? activeItems.filter((item) => item.suppliers.some((s) => s.id === selectedSupplierId))
    : [];
  const itemOptions =
    supplierItems.length > 0
      ? [
          ...supplierItems.map((item) => ({ value: item.id, label: itemLabel(item) })),
          ...activeItems
            .filter((item) => !supplierItems.includes(item))
            .map((item) => ({
              value: item.id,
              label: itemLabel(item),
              group: t('payments.otherItems'),
            })),
        ]
      : activeItems.map((item) => ({ value: item.id, label: itemLabel(item) }));

  const updateLine = (key: string, changes: Partial<Draft_Line>) =>
    setLines((current) =>
      current.map((line) => (line.key === key ? { ...line, ...changes } : line)),
    );

  const lineTotal = (line: Draft_Line) => {
    const quantity = Number(line.quantity);
    const unitPrice = Number(line.unitPrice);

    if (Number.isNaN(quantity) || Number.isNaN(unitPrice)) return 0;

    return roundMoney(quantity * unitPrice);
  };

  const hasLines = lines.length > 0;
  const linesTotal = roundMoney(lines.reduce((sum, line) => sum + lineTotal(line), 0));

  // O que foi escrito: a soma das linhas, ou o valor à mão
  const typedTotal = hasLines ? linesTotal : roundMoney(Number(amount) || 0);

  const appliedTaxes = selectedTaxIds
    .map((taxId) => taxes.find((tax) => tax.id === taxId))
    .filter((tax): tax is NonNullable<typeof tax> => Boolean(tax));

  const hasTaxes = appliedTaxes.length > 0;

  // O que ainda dá para escolher — um imposto não se aplica duas vezes
  const availableTaxes = taxes.filter((tax) => !selectedTaxIds.includes(tax.id));



  // Espelha o cálculo do backend, que é quem manda. Aqui serve só para veres o
  // total antes de gravar — os valores gravados são os que o backend calcula.
  // Com preços já com imposto, a base tira-se ao contrário: 123 / 1,23 = 100.
  const slope = appliedTaxes.reduce((sum, tax) => sum + tax.rate / 100, 0);
  const baseAmount =
    pricesIncludeTax && hasTaxes ? roundMoney(typedTotal / (1 + slope)) : typedTotal;

  const taxTotal = roundMoney(
    appliedTaxes.reduce((sum, tax) => sum + roundMoney((baseAmount * tax.rate) / 100), 0),
  );

  // O que sai do banco
  const grossAmount = roundMoney(baseAmount + taxTotal);

  const paymentCurrency = currencies.find((currency) => currency.id === currencyId);
  const companyCurrency = currencies.find((currency) => currency.id === companyCurrencyId);

  const formatIn = (value: number, symbol: string | undefined) =>
    `${value.toLocaleString(i18n.language, {
      minimumFractionDigits: 2,
      maximumFractionDigits: 2,
    })} ${symbol ?? ''}`.trim();

  const formatMoney = (value: number) => formatIn(value, paymentCurrency?.symbol);

  // --- noutra moeda: quanto vale na da empresa -------------------------------
  // A cotação do dia propõe o valor; quem tiver o extrato escreve o que o banco
  // cobrou. O backend usa o que vier escrito, ou a mesma cotação.
  const isForeign = currencyId !== companyCurrencyId;
  const exchange = useExchangeRate(isForeign ? currencyId : '', companyCurrencyId, paymentDate);
  const manualCompanyAmount = isForeign && companyAmount.trim() !== '';
  const suggestedCompanyAmount =
    exchange.rate === null ? null : roundMoney(grossAmount * exchange.rate);
  const shownCompanyAmount = manualCompanyAmount
    ? roundMoney(Number(companyAmount) || 0)
    : suggestedCompanyAmount;

  const shownDate = paymentDate.split('-').reverse().join('/');
  const companyCode = companyCurrency?.shortCode ?? '';

  // O fornecedor diz em que moeda fatura: escolhê-lo propõe-na
  const handleSupplierChange = (value: string) => {
    setSupplierId(value);

    const supplier = suppliers.find((entry) => entry.id === value);

    setCurrencyId(supplier?.currency?.id ?? companyCurrencyId);
  };

  // Os salários e recibos por pagar do membro escolhido
  const memberUpcoming = upcoming.filter((entry) => entry.memberId === memberId);
  const upcomingLabel = (entry: Upcoming_Payment) => {
    const date = entry.date.split('-').reverse().join('/');
    const what =
      entry.part === 'salary'
        ? t('upcomingPayments.part_salary', {
            month: new Date(`${entry.period.slice(0, 7)}-01T00:00:00Z`).toLocaleDateString(i18n.language, {
              month: 'long',
              timeZone: 'UTC',
            }),
          })
        : t(`upcomingPayments.part_${entry.part}`);
    return `${what} · ${date}${entry.overdue ? ` · ${t('upcomingPayments.overdue')}` : ''}`;
  };

  // Escolher o que se paga propõe o valor (o bruto, ou o líquido do recibo), a data, a moeda e a conta
  const handleMemberPayChange = (key: string) => {
    setMemberPayKey(key);
    const entry = memberUpcoming.find((item) => `${item.memberPayId}|${item.period}` === key);
    if (!entry) return;
    setAmount(String(entry.kind === 'freelance' ? entry.netAmount : entry.grossAmount));
    setPaymentDate(entry.date);
    setCurrencyId(entry.currency.id);
    if (entry.bankAccountId) setFromBankAccountId(entry.bankAccountId);
    if (!description.trim()) setDescription(upcomingLabel(entry).split(' · ')[0]);
  };

  // Quando um item é escolhido, o preço da subscrição serve de sugestão —
  // continua editável, porque o preço real é o desta compra
  const handleItemChange = (key: string, itemId: string) => {
    const item = activeItems.find((entry) => entry.id === itemId);
    const suggestedPrice = item?.defaultPrice ?? '';

    updateLine(key, { itemId, ...(suggestedPrice ? { unitPrice: suggestedPrice } : {}) });
  };

  const handleSubmit = async (event: React.FormEvent) => {
    event.preventDefault();

    if (!currencyId) {
      setAlert({ open: true, message: t('payments.currencyRequired'), type: 'error' });
      return;
    }

    if (manualCompanyAmount && !(Number(companyAmount) > 0)) {
      setAlert({ open: true, message: t('payments.companyAmountInvalid'), type: 'error' });
      return;
    }

    // Sem cotação para o dia, o valor na moeda da empresa tem de vir escrito
    if (isForeign && !manualCompanyAmount && exchange.rate === null && !exchange.loading) {
      setAlert({
        open: true,
        message: t('payments.companyAmountRequired', { code: companyCode }),
        type: 'error',
      });
      return;
    }

    if (partyType === 'supplier' && !supplierId) {
      setAlert({ open: true, message: t('payments.supplierRequired'), type: 'error' });
      return;
    }

    if (partyType === 'member' && !memberId) {
      setAlert({ open: true, message: t('payments.memberRequired'), type: 'error' });
      return;
    }

    if (paymentType === 'pay' && !fromBankAccountId) {
      setAlert({ open: true, message: t('payments.fromAccountRequired'), type: 'error' });
      return;
    }

    if (paymentType === 'receive' && !toBankAccountId) {
      setAlert({ open: true, message: t('payments.toAccountRequired'), type: 'error' });
      return;
    }

    if (paymentType === 'internal_transfer') {
      if (!fromBankAccountId || !toBankAccountId) {
        setAlert({ open: true, message: t('payments.transferAccountsRequired'), type: 'error' });
        return;
      }

      if (fromBankAccountId === toBankAccountId) {
        setAlert({ open: true, message: t('payments.sameAccount'), type: 'error' });
        return;
      }
    }

    // Uma linha sem item ou com quantidade inválida faria o backend recusar
    // o pagamento inteiro — vale a pena dizer já qual é o problema
    for (const line of lines) {
      if (!line.itemId) {
        setAlert({ open: true, message: t('payments.lineItemRequired'), type: 'error' });
        return;
      }

      const quantity = Number(line.quantity);
      const unitPrice = Number(line.unitPrice);

      if (Number.isNaN(quantity) || quantity <= 0) {
        setAlert({ open: true, message: t('payments.lineQuantityInvalid'), type: 'error' });
        return;
      }

      if (line.unitPrice.trim() === '' || Number.isNaN(unitPrice) || unitPrice < 0) {
        setAlert({ open: true, message: t('payments.linePriceInvalid'), type: 'error' });
        return;
      }
    }

    if (!hasLines && (amount.trim() === '' || Number.isNaN(Number(amount)) || Number(amount) < 0)) {
      setAlert({ open: true, message: t('payments.amountInvalid'), type: 'error' });
      return;
    }

    const payload: CompanyPaymentPayload = {
      paymentType,
      partyType,
      supplierId: partyType === 'supplier' ? supplierId : undefined,
      ...(partyType === 'member'
        ? {
            memberId,
            ...(memberPayKey
              ? { memberPayId: memberPayKey.split('|')[0], memberPayPeriod: memberPayKey.split('|')[1] }
              : {}),
          }
        : {}),
      fromBankAccountId: paymentType === 'receive' ? undefined : fromBankAccountId,
      toBankAccountId: paymentType === 'pay' ? undefined : toBankAccountId,
      // O que sai do banco; o valor escrito segue à parte para o backend
      // refazer a conta e conferir
      amount: grossAmount,
      baseAmount: hasLines ? undefined : typedTotal,
      pricesIncludeTax: pricesIncludeTax && hasTaxes ? true : undefined,
      currencyId,
      companyAmount: manualCompanyAmount ? Number(companyAmount) : undefined,
      description: description.trim(),
      reference: reference.trim(),
      paymentDate,
      status,
      items: hasLines
        ? lines.map((line) => ({
            itemId: line.itemId,
            quantity: Number(line.quantity),
            unitPrice: Number(line.unitPrice),
          }))
        : undefined,
      taxes: selectedTaxIds.length > 0 ? selectedTaxIds.map((taxId) => ({ taxId })) : undefined,
    };

    setSaving(true);
    await onSubmit(payload, files);
    setSaving(false);
  };

  // A moeda de cada conta à vista: só servem as da moeda do pagamento ou da
  // empresa
  const bankAccountOptions = bankAccounts.map((account) => {
    const code = currencies.find((currency) => currency.id === account.currencyId)?.shortCode;

    return { value: account.id, label: code ? `${account.name} · ${code}` : account.name };
  });

  return (
    <div className="Popover_Backdrop" onClick={onClose}>
      <form className="Popover_Card Wide" onClick={(e) => e.stopPropagation()} onSubmit={handleSubmit}>
        <div className="Popover_Header">
          <div className="Popover_Header_Text">
            <span className="Popover_Title">{t('payments.createTitle')}</span>
            <span className="Popover_Subtitle">{companyName}</span>
          </div>

          <button type="button" className="Popover_Close" onClick={onClose} aria-label={t('common.cancel')}>
            ×
          </button>
        </div>

        <div className="Popover_Body">
          <div className="Form_Field">
            <label htmlFor="payment-type">{t('payments.columnType')} *</label>
            <Global_Dropdown
              id="payment-type"
              value={paymentType}
              onChange={(value) => setPaymentType(value as PaymentType)}
              options={[
                { value: 'pay', label: t('payments.type_pay') },
                { value: 'receive', label: t('payments.type_receive') },
                { value: 'internal_transfer', label: t('payments.type_internal_transfer') },
              ]}
            />
          </div>

          <div className="Form_Field">
            <label htmlFor="payment-party-type">{t('payments.partyType')} *</label>
            <Global_Dropdown
              id="payment-party-type"
              value={partyType}
              onChange={(value) => setPartyType(value as PartyType)}
              options={[
                { value: 'supplier', label: t('payments.party_supplier') },
                { value: 'member', label: t('payments.party_memberOption') },
                { value: 'shareholder', label: t('payments.party_shareholderOption') },
                { value: 'customer', label: t('payments.party_customer') },
              ]}
            />
            {partyType === 'shareholder' && <span className="Field_Hint">{t('payments.shareholderHint')}</span>}
          </div>

          {partyType === 'member' && (
            <>
              <div className="Form_Field">
                <label htmlFor="payment-member">{t('payments.member')} *</label>
                <Global_Dropdown
                  id="payment-member"
                  value={memberId}
                  onChange={(value) => {
                    setMemberId(String(value));
                    setMemberPayKey('');
                  }}
                  placeholder={t('payments.selectPlaceholder')}
                  searchable
                  options={members.map((member) => ({ value: member.id, label: member.name }))}
                />
              </div>
              <div className="Form_Field">
                <label htmlFor="payment-member-pay">{t('payments.memberPay')}</label>
                <Global_Dropdown
                  id="payment-member-pay"
                  value={memberPayKey}
                  onChange={(value) => handleMemberPayChange(String(value))}
                  disabled={!memberId}
                  options={[
                    { value: '', label: t('payments.memberPayNone') },
                    ...memberUpcoming.map((entry) => ({
                      value: `${entry.memberPayId}|${entry.period}`,
                      label: upcomingLabel(entry),
                    })),
                  ]}
                />
                <span className="Field_Hint">{t('payments.memberPayHint')}</span>
              </div>
            </>
          )}

          {partyType === 'supplier' && (
            <div className="Form_Field">
              <label htmlFor="payment-supplier">{t('payments.columnSupplier')} *</label>
              <Global_Dropdown
                id="payment-supplier"
                value={supplierId}
                onChange={(value) => handleSupplierChange(value as string)}
                disabled={loadingSuppliers}
                placeholder={t('payments.selectPlaceholder')}
                searchable
                // Criar um fornecedor sai daqui para a página inteira; no fim
                // volta aos pagamentos e o formulário reabre com ele escolhido
                action={{
                  label: t('payments.newSupplier'),
                  onClick: () => {
                    const state: New_Supplier_State = { returnTo: location.pathname };
                    navigate(`/Companies/${slug}/compras/fornecedores/new-supplier`, { state });
                  },
                }}
                options={suppliers.map((supplier) => ({
                  value: supplier.id,
                  label: supplier.name,
                }))}
              />
            </div>
          )}

          {/* Um recebimento não sai de lado nenhum; um pagamento não entra */}
          {paymentType !== 'receive' && (
            <div className="Form_Field">
              <label htmlFor="payment-from-account">{t('payments.fromAccount')} *</label>
              <Global_Dropdown
                id="payment-from-account"
                value={fromBankAccountId}
                onChange={(value) => setFromBankAccountId(value as string)}
                disabled={loadingBankAccounts}
                placeholder={t('payments.selectPlaceholder')}
                options={bankAccountOptions}
              />
            </div>
          )}

          {paymentType !== 'pay' && (
            <div className="Form_Field">
              <label htmlFor="payment-to-account">{t('payments.toAccount')} *</label>
              <Global_Dropdown
                id="payment-to-account"
                value={toBankAccountId}
                onChange={(value) => setToBankAccountId(value as string)}
                disabled={loadingBankAccounts}
                placeholder={t('payments.selectPlaceholder')}
                options={bankAccountOptions}
              />
            </div>
          )}

          <div className="Form_Field">
            <label htmlFor="payment-currency">{t('payments.columnCurrency')}</label>
            {/* O valor, as linhas e os impostos ficam nesta moeda */}
            <Global_Dropdown
              id="payment-currency"
              value={currencyId}
              onChange={(value) => setCurrencyId(value as string)}
              searchable
              options={currencies.map((currency) => ({
                value: currency.id,
                label: `${currency.shortCode} (${currency.symbol})`,
              }))}
            />
          </div>

          {/* Noutra moeda: o valor na da empresa. Proposto pela cotação do dia
              (em cinzento); escrever outro fixa o do extrato. */}
          {isForeign && (
            <div className="Form_Field">
              <label htmlFor="payment-company-amount">
                {t('payments.companyAmount', { code: companyCode })}
              </label>
              <Global_Input
                id="payment-company-amount"
                type="number"
                value={companyAmount}
                onChange={(e) => setCompanyAmount(e.target.value)}
                placeholder={suggestedCompanyAmount === null ? '0.00' : suggestedCompanyAmount.toFixed(2)}
              />
              {manualCompanyAmount ? (
                <span className="Field_Hint">
                  {t('payments.rateManual')}
                  {' · '}
                  <button type="button" className="Hint_Action" onClick={() => setCompanyAmount('')}>
                    {t('payments.rateUseMarket')}
                  </button>
                </span>
              ) : exchange.loading ? (
                <span className="Field_Hint">{t('payments.rateLoading', { date: shownDate })}</span>
              ) : exchange.rate !== null ? (
                <span className="Field_Hint">
                  {t('payments.rateMarket', {
                    date: shownDate,
                    from: paymentCurrency?.shortCode ?? '',
                    rate: exchange.rate.toLocaleString(i18n.language, { maximumFractionDigits: 6 }),
                    to: companyCode,
                  })}
                </span>
              ) : (
                <span className="Field_Hint Field_Hint_Error">
                  {t('payments.rateMissing', { code: companyCode })}
                </span>
              )}
            </div>
          )}

          <div className="Form_Field">
            <label htmlFor="payment-date">{t('payments.columnDate')} *</label>
            <Global_Input
              id="payment-date"
              type="date"
              value={paymentDate}
              onChange={(e) => setPaymentDate(e.target.value)}
            />
          </div>

          <div className="Form_Field">
            <label htmlFor="payment-status">{t('payments.columnStatus')}</label>
            <Global_Dropdown
              id="payment-status"
              value={status}
              onChange={(value) => setStatus(value as PaymentStatus)}
              options={[
                { value: 'completed', label: t('payments.status_completed') },
                { value: 'draft', label: t('payments.status_draft') },
                { value: 'cancelled', label: t('payments.status_cancelled') },
              ]}
            />
          </div>

          <div className="Form_Field">
            <label htmlFor="payment-reference">{t('payments.reference')}</label>
            <Global_Input
              id="payment-reference"
              value={reference}
              onChange={(e) => setReference(e.target.value)}
              placeholder={t('payments.referencePlaceholder')}
            />
          </div>

          {/* Detalhe do que foi comprado. Sem linhas, o pagamento é só um valor. */}
          <div className="Form_Field Full_Width">
            <div className="Lines_Header">
              <label>{t('payments.linesTitle')}</label>
              <div className="Documents_Action">
                <Simple_Button
                  text={t('payments.addLine')}
                  onClick={() => setLines((current) => [...current, emptyLine()])}
                  disabled={loadingItems || activeItems.length === 0}
                />
              </div>
            </div>

            {activeItems.length === 0 && !loadingItems ? (
              <span className="Lines_Empty">{t('payments.noItems')}</span>
            ) : lines.length === 0 ? (
              <span className="Lines_Empty">{t('payments.noLines')}</span>
            ) : (
              <div className="Payment_Lines">
                {lines.map((line) => (
                  <div className="Payment_Line" key={line.key}>
                    <div className="Line_Item">
                      <Global_Dropdown
                        value={line.itemId}
                        onChange={(value) => handleItemChange(line.key, value as string)}
                        placeholder={t('payments.selectItem')}
                        searchable
                        // Criar um item sai daqui para a página inteira; no fim
                        // volta aos pagamentos e o formulário reabre com ele numa linha
                        action={{
                          label: t('payments.newItem'),
                          onClick: () => {
                            // O item novo já fica ligado ao fornecedor escolhido
                            const state: New_Item_State = {
                              returnTo: location.pathname,
                              supplierId: selectedSupplierId || undefined,
                            };
                            navigate(`/Companies/${slug}/compras/itens/new-item`, { state });
                          },
                        }}
                        options={itemOptions}
                      />
                    </div>

                    <div className="Line_Number">
                      <Global_Input
                        type="number"
                        value={line.quantity}
                        onChange={(e) => updateLine(line.key, { quantity: e.target.value })}
                        placeholder={t('payments.quantity')}
                      />
                    </div>

                    <div className="Line_Number">
                      <Global_Input
                        type="number"
                        value={line.unitPrice}
                        onChange={(e) => updateLine(line.key, { unitPrice: e.target.value })}
                        placeholder={t('payments.unitPrice')}
                      />
                    </div>

                    <span className="Line_Total">{formatMoney(lineTotal(line))}</span>

                    <button
                      type="button"
                      className="Line_Remove"
                      onClick={() =>
                        setLines((current) => current.filter((entry) => entry.key !== line.key))
                      }
                      title={t('common.delete')}
                      aria-label={t('common.delete')}
                    >
                      <Icon.Trash />
                    </button>
                  </div>
                ))}
              </div>
            )}
          </div>

          {/* O IVA e afins somam-se por cima da base. Os valores que ficam
              gravados são os que o backend calcula — isto aqui é a prévia. */}
          <div className="Form_Field Full_Width">
            <div className="Lines_Header">
              <label>{t('payments.taxesTitle')}</label>
            </div>

            {loadingTaxes ? (
              <span className="Lines_Empty">{t('common.loading')}</span>
            ) : taxes.length === 0 ? (
              <span className="Lines_Empty">{t('payments.noTaxesAvailable')}</span>
            ) : (
              <>
                {/* Já escolhidos, pela ordem em que entraram — a ordem conta
                    quando um imposto incide sobre a linha anterior */}
                {appliedTaxes.length > 0 && (
                  <div className="Tax_Rows">
                    {appliedTaxes.map((tax) => (
                      <div className="Tax_Row" key={tax.id}>
                        <span className="Tax_Row_Name">
                          {tax.name}
                          {tax.countryId !== companyCountryId && tax.country && (
                            <span className="Tax_Row_Country">{tax.country.name}</span>
                          )}
                        </span>
                        <span className="Tax_Row_Rate">{tax.rate}%</span>
                        <span className="Tax_Row_Value">
                          {formatMoney(roundMoney((baseAmount * tax.rate) / 100))}
                        </span>
                        <button
                          type="button"
                          className="Line_Remove"
                          onClick={() =>
                            setSelectedTaxIds((current) => current.filter((id) => id !== tax.id))
                          }
                          title={t('common.delete')}
                          aria-label={t('common.delete')}
                        >
                          <Icon.Trash />
                        </button>
                      </div>
                    ))}
                  </div>
                )}

                {availableTaxes.length > 0 && (
                  <Global_Dropdown
                    id="payment-add-tax"
                    value=""
                    onChange={(value) =>
                      setSelectedTaxIds((current) => [...current, value as string])
                    }
                    placeholder={t('payments.addTax')}
                    searchable
                    options={availableTaxes.map((tax) => ({
                      value: tax.id,
                      // O país só aparece quando não é o da empresa, senão
                      // repetia-se em todas as linhas sem dizer nada
                      label:
                        tax.countryId === companyCountryId || !tax.country
                          ? `${tax.name} (${tax.rate}%)`
                          : `${tax.name} (${tax.rate}%) · ${tax.country.name}`,
                    }))}
                  />
                )}
              </>
            )}

            {/* A fatura tanto pode vir "100 + IVA" como "123 com IVA incluído".
                Nos dois casos o que fica guardado é 100 + 23. */}
            {hasTaxes && (
              <label className="Checkbox_Field Inclusive_Toggle" htmlFor="payment-inclusive">
                <input
                  id="payment-inclusive"
                  type="checkbox"
                  checked={pricesIncludeTax}
                  onChange={(e) => setPricesIncludeTax(e.target.checked)}
                />
                <span>{t('payments.pricesIncludeTax')}</span>
              </label>
            )}
          </div>

          <div className="Form_Field">
            <label htmlFor="payment-amount">
              {pricesIncludeTax && hasTaxes
                ? `${t('payments.typedAmount')} *`
                : `${t('payments.baseAmount')} *`}
            </label>
            {hasLines ? (
              // Com linhas a base é a soma delas — editá-la à mão só criaria um
              // pagamento cujo total não bate com o próprio detalhe
              <div className="Amount_Readonly">
                <span>{formatMoney(typedTotal)}</span>
                <span className="Amount_Hint">{t('payments.amountFromLines')}</span>
              </div>
            ) : (
              <Global_Input
                id="payment-amount"
                type="number"
                value={amount}
                onChange={(e) => setAmount(e.target.value)}
                placeholder="0.00"
              />
            )}
          </div>

          <div className="Form_Field">
            <label>{t('payments.columnAmount')}</label>
            <div className="Amount_Summary">
              <div className="Amount_Row">
                <span>{t('payments.baseAmount')}</span>
                <span>{formatMoney(baseAmount)}</span>
              </div>
              <div className="Amount_Row">
                <span>{t('payments.taxesTitle')}</span>
                <span>{formatMoney(taxTotal)}</span>
              </div>
              <div className="Amount_Row Total">
                <span>{t('payments.grossAmount')}</span>
                <span>{formatMoney(grossAmount)}</span>
              </div>
              {isForeign && (
                <div className="Amount_Row">
                  <span>{t('payments.companyAmount', { code: companyCode })}</span>
                  <span>
                    {shownCompanyAmount === null
                      ? '—'
                      : formatIn(shownCompanyAmount, companyCurrency?.symbol)}
                  </span>
                </div>
              )}
            </div>
          </div>

          {/* Ficam em espera: um documento agarra-se a um pagamento, e o
              pagamento só existe depois de gravar */}
          <div className="Form_Field Full_Width">
            <div className="Documents_Header">
              <label>{t('documents.title')}</label>
              <div className="Documents_Action">
                <Simple_Button
                  text={t('documents.add')}
                  onClick={() => fileInputRef.current?.click()}
                  disabled={saving}
                />
              </div>
            </div>

            <input
              ref={fileInputRef}
              type="file"
              multiple
              accept=".pdf,.png,.jpg,.jpeg,.webp"
              className="Documents_Input"
              onChange={(e) => {
                const chosen = e.target.files;

                if (chosen) setFiles((current) => [...current, ...Array.from(chosen)]);

                // Sem isto, escolher o mesmo ficheiro outra vez não dispara o onChange
                if (fileInputRef.current) fileInputRef.current.value = '';
              }}
            />

            {files.length === 0 ? (
              <span className="Lines_Empty">{t('documents.emptyForm')}</span>
            ) : (
              <div className="Documents_List">
                {files.map((file, index) => (
                  <div className="Document_Row" key={`${file.name}-${index}`}>
                    {/* Ainda não há nada para descarregar — é só a lista do
                        que vai ser enviado */}
                    <div className="Document_Info">
                      <span className="Document_Name">{file.name}</span>
                      <span className="Document_Meta">{formatSize(file.size)}</span>
                    </div>

                    <div className="Document_Actions">
                      <button
                        type="button"
                        className="Row_Action Danger"
                        onClick={() =>
                          setFiles((current) => current.filter((_, i) => i !== index))
                        }
                        title={t('common.delete')}
                        aria-label={t('common.delete')}
                      >
                        <Icon.Trash />
                      </button>
                    </div>
                  </div>
                ))}
              </div>
            )}
          </div>

          <div className="Form_Field Full_Width">
            <label htmlFor="payment-description">{t('payments.description')}</label>
            <textarea
              id="payment-description"
              className="Form_Textarea"
              value={description}
              onChange={(e) => setDescription(e.target.value)}
              placeholder={t('payments.descriptionPlaceholder')}
              rows={3}
            />
          </div>
        </div>

        <div className="Popover_Footer">
          <div className="Form_Action">
            <Simple_Button text={t('common.cancel')} onClick={onClose} />
          </div>
          <div className="Form_Action">
            <Simple_Button
              type="submit"
              text={saving ? t('common.saving') : t('common.save')}
              disabled={saving}
            />
          </div>
        </div>
      </form>
    </div>
  );
};

export default Payment_Form_Popover;

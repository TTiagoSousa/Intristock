import { useEffect, useMemo, useRef, useState } from 'react';
import { useTranslation } from 'react-i18next';
import http from '../../Service/httpService';
import { End_Points } from '../../Service/endPoints';
import { useAlert } from '../../Contexts/Alert_Context';
import { getErrorMessage, useAsyncRequest } from '../useAsyncRequest';

export const PAYMENT_TYPES = ['pay', 'receive', 'internal_transfer'] as const;
export type PaymentType = (typeof PAYMENT_TYPES)[number];

// member: um salário ou recibo verde; shareholder: o sócio ou o dono (o que tira da empresa)
export const PARTY_TYPES = ['supplier', 'member', 'shareholder', 'customer'] as const;
export type PartyType = (typeof PARTY_TYPES)[number];

export const PAYMENT_STATUSES = ['draft', 'completed', 'cancelled'] as const;
export type PaymentStatus = (typeof PAYMENT_STATUSES)[number];

// De onde veio a taxa para a moeda da empresa: a mesma moeda, a cotação do
// dia ou o valor do extrato escrito à mão
export type RateSource = 'same' | 'market' | 'manual';

// Os valores chegam como string — o Prisma serializa Decimal assim
export interface CompanyPaymentItemLine {
  id: string;
  itemId: string;
  quantity: string;
  unitPrice: string;
  totalPrice: string;
  item: { id: string; name: string; unit: string | null } | null;
}

export interface CompanyPaymentTaxLine {
  id: string;
  taxId: string;
  calculationType: string;
  // A taxa é Float no Prisma, por isso chega mesmo como number
  rate: number;
  // Base sobre a qual o imposto incidiu
  netAmount: string;
  taxAmount: string;
  totalAmount: string;
  tax: { id: string; name: string } | null;
}

export interface CompanyPayment {
  id: string;
  companyId: string;
  paymentType: PaymentType;
  partyType: PartyType;
  supplierId: string | null;
  fromBankAccountId: string | null;
  toBankAccountId: string | null;
  // Na moeda do pagamento; na da empresa vale `amount × exchangeRate`
  amount: string;
  currencyId: string;
  exchangeRate: string;
  rateSource: RateSource;
  description: string | null;
  reference: string | null;
  paymentDate: string;
  status: PaymentStatus;
  createdAt: string;
  supplier: { id: string; name: string } | null;
  // Num salário ou recibo verde (`partyType` member)
  member?: { id: string; name: string | null; user: { fullName: string } | null } | null;
  currency: { id: string; shortCode: string; symbol: string } | null;
  fromBankAccount: { id: string; name: string } | null;
  toBankAccount: { id: string; name: string } | null;
  items: CompanyPaymentItemLine[];
  taxes: CompanyPaymentTaxLine[];
}

export interface CompanyPaymentItemPayload {
  itemId: string;
  quantity: number;
  unitPrice: number;
}

// O backend só quer saber que impostos se aplicam — os valores são calculados lá
export interface CompanyPaymentTaxPayload {
  taxId: string;
}

export interface CompanyPaymentPayload {
  paymentType: PaymentType;
  partyType: PartyType;
  supplierId?: string;
  // Com `partyType` member; o salário e o período só se vier de um deles
  memberId?: string;
  memberPayId?: string;
  memberPayPeriod?: string;
  fromBankAccountId?: string;
  toBankAccountId?: string;
  // O que sai do banco, já com impostos
  amount: number;
  // O valor escrito, quando não há linhas de item. Já com imposto se o
  // `pricesIncludeTax` for true.
  baseAmount?: number;
  // Os preços escritos já trazem o imposto lá dentro
  pricesIncludeTax?: boolean;
  currencyId: string;
  // Só noutra moeda: o que saiu na moeda da empresa (o extrato). Sem ele, o
  // backend usa a cotação do dia.
  companyAmount?: number;
  description?: string;
  reference?: string;
  paymentDate: string;
  status?: PaymentStatus;
  items?: CompanyPaymentItemPayload[];
  taxes?: CompanyPaymentTaxPayload[];
}

// O que se corrige num pagamento gravado. Aqui só o valor na moeda da empresa:
// escrito à mão, ou de volta à cotação do dia.
export interface CompanyPaymentUpdatePayload {
  companyAmount?: number;
  useMarketRate?: boolean;
}

// A resposta do GET é paginada: a página pedida mais o total da empresa toda
interface CompanyPaymentsPage {
  items: CompanyPayment[];
  total: number;
}

// Linhas por página no ecrã
export const PAYMENTS_PAGE_SIZE = 10;

// Um bloco é uma página: dez por pedido. Os pagamentos traziam vinte de cada
// vez para navegar duas páginas sem pedir nada, mas isso fazia deles a única
// tabela da app com regra própria — e o ganho era um pedido a menos de dois.
export const PAYMENTS_BLOCK_SIZE = PAYMENTS_PAGE_SIZE;

// companyId é o uuid da empresa — o slug do URL não serve para a API
export const useCompanyPayments = (companyId: string | undefined) => {
  // Blocos já descarregados, indexados pela sua posição (0 = 1º, 1 = 2º, ...)
  const [blocks, setBlocks] = useState<Record<number, CompanyPayment[]>>({});
  const [total, setTotal] = useState(0);
  const [page, setPage] = useState(1);
  const [loading, setLoading] = useState(true);
  const [loadingPage, setLoadingPage] = useState(false);

  // Distingue a primeira carga (ecrã ainda vazio) de uma troca de bloco (já há
  // linhas à vista), que não deve fazer a tabela desaparecer
  const hasLoadedOnce = useRef(false);
  // Bloco que está a ser pedido agora, para o mesmo pedido não sair duas vezes
  const inFlightBlock = useRef<number | null>(null);
  // Cada carga leva um número. Se entretanto sair outra (ou se mudar de
  // empresa), a resposta antiga chega e é deitada fora — senão, trocar de
  // empresa a meio de um pedido enchia a tabela com os pagamentos da anterior
  const requestToken = useRef(0);
  // Últimas linhas mostradas, para as manter enquanto o bloco seguinte não chega
  const lastShown = useRef<CompanyPayment[]>([]);

  const { run } = useAsyncRequest();
  const { setAlert } = useAlert();
  const { t } = useTranslation();

  const totalPages = Math.max(1, Math.ceil(total / PAYMENTS_PAGE_SIZE));
  // A página é limitada aqui e não só no efeito: quando a lista encolhe, a
  // página atual pode deixar de existir e o ecrã ficaria vazio até o efeito
  // corrigir
  const safePage = Math.min(page, totalPages);

  const blockIndex = Math.floor(((safePage - 1) * PAYMENTS_PAGE_SIZE) / PAYMENTS_BLOCK_SIZE);
  const block = blocks[blockIndex];
  const offsetInBlock = (safePage - 1) * PAYMENTS_PAGE_SIZE - blockIndex * PAYMENTS_BLOCK_SIZE;

  // Campos vazios não podem seguir: o backend valida os opcionais como UUID e
  // uma string vazia falha a validação em vez de ser tratada como ausente
  const cleanPayload = (payload: CompanyPaymentPayload) =>
    Object.fromEntries(
      Object.entries(payload).filter(([, value]) => value !== '' && value !== undefined),
    );

  const loadBlock = async (index: number) => {
    if (!companyId || inFlightBlock.current === index) return;

    const token = ++requestToken.current;

    inFlightBlock.current = index;
    hasLoadedOnce.current ? setLoadingPage(true) : setLoading(true);

    try {
      const { data } = await http.get<CompanyPaymentsPage>(
        End_Points.Company_Payments_Endpoint(companyId),
        { params: { skip: index * PAYMENTS_BLOCK_SIZE, take: PAYMENTS_BLOCK_SIZE } },
      );

      if (token !== requestToken.current) return;

      setBlocks((current) => ({ ...current, [index]: data.items }));
      setTotal(data.total);
      hasLoadedOnce.current = true;
    } catch (error: any) {
      if (token === requestToken.current) {
        setAlert({ open: true, message: getErrorMessage(error), type: 'error' });
      }
    } finally {
      // Uma resposta atrasada não pode desligar o carregamento da que veio a seguir
      if (token === requestToken.current) {
        inFlightBlock.current = null;
        setLoading(false);
        setLoadingPage(false);
      }
    }
  };

  // Trocar de empresa deita fora tudo o que estava em cache, e invalida o que
  // estiver a caminho
  useEffect(() => {
    requestToken.current += 1;
    inFlightBlock.current = null;
    hasLoadedOnce.current = false;
    lastShown.current = [];

    setBlocks({});
    setTotal(0);
    setPage(1);
    setLoading(true);
    setLoadingPage(false);
  }, [companyId]);

  // Pede o bloco da página atual, se ainda não o tiver
  useEffect(() => {
    if (!companyId || blocks[blockIndex]) return;

    loadBlock(blockIndex);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [companyId, blockIndex, blocks]);

  // Alinha o estado com a página que está mesmo a ser mostrada
  useEffect(() => {
    if (page > totalPages) setPage(totalPages);
  }, [page, totalPages]);

  const pageItems = useMemo(
    () => (block ? block.slice(offsetInBlock, offsetInBlock + PAYMENTS_PAGE_SIZE) : null),
    [block, offsetInBlock],
  );

  useEffect(() => {
    if (pageItems) lastShown.current = pageItems;
  }, [pageItems]);

  // Enquanto o bloco seguinte não chega, ficam as linhas anteriores à vista —
  // esvaziar a tabela mexia na altura da página a cada salto
  const payments = pageItems ?? lastShown.current;

  // Deitar a cache fora chega: o efeito acima volta a pedir o bloco atual
  const refresh = async () => {
    setBlocks({});
    await loadBlock(blockIndex);
  };

  const createPayment = async (payload: CompanyPaymentPayload) => {
    if (!companyId) return undefined;

    const response = await run(() =>
      http.post(End_Points.Company_Payments_Endpoint(companyId), cleanPayload(payload)),
    );

    if (response) setAlert({ open: true, message: t('payments.created'), type: 'success' });

    return response?.data;
  };

  // Devolve o pagamento como o backend o deixou (só os campos dele, sem as
  // relações), ou nada se falhar
  const updatePayment = async (paymentId: string, payload: CompanyPaymentUpdatePayload) => {
    if (!companyId) return undefined;

    const response = await run(() =>
      http.patch<CompanyPayment>(End_Points.Company_Payment_Endpoint(companyId, paymentId), payload),
    );

    if (!response) return undefined;

    setAlert({ open: true, message: t('payments.companyAmountUpdated'), type: 'success' });
    await refresh();

    return response.data;
  };

  const deletePayment = async (paymentId: string) => {
    if (!companyId) return false;

    try {
      await http.delete(End_Points.Company_Payment_Endpoint(companyId, paymentId));

      // Apagar desalinha as páginas seguintes todas, por isso a cache vai
      // inteira abaixo em vez de se tirar a linha do bloco em memória
      await refresh();
      setAlert({ open: true, message: t('payments.deleted'), type: 'success' });
      return true;
    } catch (error: any) {
      setAlert({ open: true, message: getErrorMessage(error), type: 'error' });
      return false;
    }
  };

  return {
    payments,
    total,
    page: safePage,
    setPage,
    totalPages,
    pageSize: PAYMENTS_PAGE_SIZE,
    loading,
    loadingPage,
    refresh,
    createPayment,
    updatePayment,
    deletePayment,
  };
};

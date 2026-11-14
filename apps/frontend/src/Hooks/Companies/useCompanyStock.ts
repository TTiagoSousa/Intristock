import { useTranslation } from 'react-i18next';
import http from '../../Service/httpService';
import { End_Points } from '../../Service/endPoints';
import { useAlert } from '../../Contexts/Alert_Context';
import { useAsyncRequest } from '../useAsyncRequest';
import { usePaginatedResource } from '../usePaginatedResource';

export const STOCK_MOVEMENT_TYPES = ['in', 'out', 'adjustment'] as const;
export type StockMovementType = (typeof STOCK_MOVEMENT_TYPES)[number];

export type StockSourceType = 'payment' | 'manual' | 'production';

export interface StockMovement {
  id: string;
  companyId: string;
  itemId: string;
  type: StockMovementType;
  // O Prisma serializa Decimal como string — nunca assumir number aqui
  quantity: string;
  unitCost: string | null;
  sourceType: StockSourceType;
  paymentId: string | null;
  occurredAt: string;
  note: string | null;
  createdAt: string;
  item: { id: string; name: string; stockUnit: string | null };
}

// O saldo não existe em tabela nenhuma: vem calculado da soma dos movimentos
export interface StockBalance {
  itemId: string;
  itemName: string;
  stockUnit: string | null;
  quantity: number;
  averageUnitCost: number;
  totalValue: number;
  movements: number;
  lastMovementAt: string | null;
}

export interface StockMovementPayload {
  itemId: string;
  type: StockMovementType;
  quantity: number;
  unitCost?: number;
  occurredAt: string;
  note?: string;
}

// companyId é o uuid da empresa — o slug do URL não serve para a API
export const useCompanyStock = (companyId: string | undefined, itemId?: string) => {
  // Duas listas com paginações independentes: quem está na página 3 dos
  // movimentos não quer que olhar para o saldo o mande ao princípio
  const balanceList = usePaginatedResource<StockBalance>(
    companyId ? End_Points.Company_Stock_Balance_Endpoint(companyId) : undefined,
  );

  const movementsList = usePaginatedResource<StockMovement>(
    companyId ? End_Points.Company_Stock_Movements_Endpoint(companyId) : undefined,
    { itemId },
  );

  const { run } = useAsyncRequest();
  const { setAlert } = useAlert();
  const { t } = useTranslation();

  // Um movimento novo mexe nas duas: muda o saldo e entra na lista
  const refresh = async () => {
    await Promise.all([balanceList.refresh(), movementsList.refresh()]);
  };

  const createMovement = async (payload: StockMovementPayload) => {
    if (!companyId) return undefined;

    const body = Object.fromEntries(
      Object.entries(payload).filter(([, value]) => value !== '' && value !== undefined),
    );

    const response = await run(() =>
      http.post(End_Points.Company_Stock_Movements_Endpoint(companyId), body),
    );

    if (response) setAlert({ open: true, message: t('stock.movementCreated'), type: 'success' });

    return response?.data;
  };

  const deleteMovement = async (movementId: string) => {
    if (!companyId) return false;

    const response = await run(() =>
      http.delete(End_Points.Company_Stock_Movement_Endpoint(companyId, movementId)),
    );

    if (response) setAlert({ open: true, message: t('stock.movementDeleted'), type: 'success' });

    return Boolean(response);
  };

  return {
    balance: balanceList.items,
    balancePage: balanceList.page,
    setBalancePage: balanceList.setPage,
    balanceTotal: balanceList.total,
    balanceTotalPages: balanceList.totalPages,
    // O valor de tudo o que está em mão, vindo do backend
    stockValue: (balanceList.extra.totalValue as number) ?? 0,

    movements: movementsList.items,
    movementsPage: movementsList.page,
    setMovementsPage: movementsList.setPage,
    movementsTotal: movementsList.total,
    movementsTotalPages: movementsList.totalPages,

    pageSize: balanceList.pageSize,
    loading: balanceList.loading || movementsList.loading,
    loadingPage: balanceList.loadingPage || movementsList.loadingPage,
    refresh,
    createMovement,
    deleteMovement,
  };
};

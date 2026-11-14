import { useTranslation } from 'react-i18next';
import http from '../../Service/httpService';
import { End_Points } from '../../Service/endPoints';
import { useAlert } from '../../Contexts/Alert_Context';
import { useAsyncRequest } from '../useAsyncRequest';
import { usePaginatedResource } from '../usePaginatedResource';

// Lista fechada, igual à do backend
export const ASSET_CATEGORIES = [
  'equipamento_basico',
  'equipamento_informatico',
  'equipamento_administrativo',
  'mobiliario',
  'viaturas',
  'edificios',
  'intangivel',
] as const;
export type AssetCategory = (typeof ASSET_CATEGORIES)[number];

export const ASSET_STATUSES = ['em_uso', 'manutencao', 'abatido', 'vendido'] as const;
export type AssetStatus = (typeof ASSET_STATUSES)[number];

export interface CompanyAsset {
  id: string;
  companyId: string;
  paymentId: string | null;
  itemId: string | null;
  name: string;
  category: AssetCategory;
  acquisitionDate: string;
  // O Prisma serializa Decimal como string — nunca assumir number aqui
  acquisitionValue: string;
  currencyId: string;
  depreciationRate: string;
  usefulLifeHours: number | null;
  residualValue: string | null;
  status: AssetStatus;
  disposedAt: string | null;
  disposalValue: string | null;
  notes: string | null;
  currency: { id: string; shortCode: string; symbol: string } | null;
  item: { id: string; name: string } | null;
  payment: { id: string; reference: string | null; paymentDate: string } | null;

  // Calculados na leitura, não guardados: o backend deriva-os do valor, da
  // taxa e da data de cada vez que a lista é pedida
  elapsedYears: number;
  accumulatedDepreciation: number;
  netBookValue: number;
  // Custo de desgaste por hora — só quando o ativo tem vida útil em horas
  costPerHour: number | null;
}

export interface CompanyAssetPayload {
  name?: string;
  category?: AssetCategory;
  acquisitionDate?: string;
  acquisitionValue?: number;
  currencyId?: string;
  depreciationRate?: number;
  usefulLifeHours?: number;
  residualValue?: number;
  itemId?: string;
  // A compra de origem. Vazio = ativo sem compra associada (equipamento que já
  // se tinha, ou entrado como capital) — o vazio é filtrado antes de seguir
  paymentId?: string;
  notes?: string;
  status?: AssetStatus;
  disposedAt?: string;
  disposalValue?: number;
}

// companyId é o uuid da empresa — o slug do URL não serve para a API
export const useCompanyAssets = (companyId: string | undefined) => {
  // A leitura é paginada pelo servidor: dez por página, e a página 2 vai
  // buscar os dez seguintes. Para encher um dropdown usa-se o
  // `useCompanyAssetOptions` — dez opções só deixariam escolher dez.
  const list = usePaginatedResource<CompanyAsset>(
    companyId ? End_Points.Company_Assets_Endpoint(companyId) : undefined,
  );

  const { run } = useAsyncRequest();
  const { setAlert } = useAlert();
  const { t } = useTranslation();

  // Campos vazios não podem seguir: o backend valida os opcionais como UUID e
  // uma string vazia falha a validação em vez de ser tratada como ausente
  const cleanPayload = (payload: CompanyAssetPayload) =>
    Object.fromEntries(
      Object.entries(payload).filter(([, value]) => value !== '' && value !== undefined),
    );



  const createAsset = async (payload: CompanyAssetPayload) => {
    if (!companyId) return undefined;

    const response = await run(() =>
      http.post(End_Points.Company_Assets_Endpoint(companyId), cleanPayload(payload)),
    );

    if (response) setAlert({ open: true, message: t('assets.created'), type: 'success' });

    return response?.data;
  };

  const updateAsset = async (assetId: string, payload: CompanyAssetPayload) => {
    if (!companyId) return undefined;

    const response = await run(() =>
      http.patch(End_Points.Company_Asset_Endpoint(companyId, assetId), cleanPayload(payload)),
    );

    if (response) setAlert({ open: true, message: t('assets.updated'), type: 'success' });

    return response?.data;
  };

  const deleteAsset = async (assetId: string) => {
    if (!companyId) return false;

    const response = await run(() =>
      http.delete(End_Points.Company_Asset_Endpoint(companyId, assetId)),
    );

    if (response) setAlert({ open: true, message: t('assets.deleted'), type: 'success' });

    return Boolean(response);
  };

  return {
    assets: list.items,
    page: list.page,
    setPage: list.setPage,
    total: list.total,
    totalPages: list.totalPages,
    // Somas de todo o imobilizado, vindas do backend
    totals: (list.extra.totals as { acquisition: number; depreciated: number; net: number }) ?? {
      acquisition: 0,
      depreciated: 0,
      net: 0,
    },
    pageSize: list.pageSize,
    loadingPage: list.loadingPage,
    loading: list.loading,
    refresh: list.refresh,
    createAsset,
    updateAsset,
    deleteAsset,
  };
};

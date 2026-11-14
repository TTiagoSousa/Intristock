import { useEffect, useRef, useState } from 'react';
import http from '../../Service/httpService';
import { End_Points } from '../../Service/endPoints';
import { getErrorMessage } from '../useAsyncRequest';

export interface Prop_Firm_Sync_Status {
  running: boolean;
  startedAt: string | null;
  finishedAt: string | null;
  error: string | null;
  progress: {
    phase: 'list' | 'details' | 'done';
    created: number;
    updated: number;
    deactivated: number;
    detailsDone: number;
    detailsTotal: number;
    detailsFailed: number;
  } | null;
  // Na base: as prop firms ativas, as que vieram da API e a última atualização
  total: number;
  fromApi: number;
  plans: number;
  lastSyncedAt: string | null;
}

export type Prop_Firm_Compare_Status = 'new' | 'changed' | 'same' | 'removed' | 'local';

export interface Prop_Firm_Snapshot {
  name: string;
  website: string | null;
  logo: string | null;
  country: string | null;
  assetType: string | null;
  score: number | null;
  safetyGrade: string | null;
  profitSplit: string | null;
}

export interface Prop_Firm_Compare_Row {
  key: string;
  name: string;
  status: Prop_Firm_Compare_Status;
  diffs: (keyof Prop_Firm_Snapshot)[];
  api: Prop_Firm_Snapshot | null;
  db:
    | (Prop_Firm_Snapshot & {
        id: string;
        isActive: boolean;
        source: string;
        syncedAt: string | null;
        detailsSyncedAt: string | null;
        plans: number | null;
      })
    | null;
}

export interface Prop_Firm_Compare {
  checkedAt: string;
  apiCount: number;
  dbCount: number;
  counts: Record<Prop_Firm_Compare_Status, number>;
  rows: Prop_Firm_Compare_Row[];
}

// Enquanto o atualizar corre, o estado lê-se de 2 em 2 s
const POLL_MS = 2_000;

/**
 * O atualizar das prop firms (PropFirmMap → plataformas): o estado, arrancá-lo
 * e a base contra a API. Corre no servidor em fundo (~5 min); aqui só se lê.
 */
export const usePropFirmSync = () => {
  const [status, setStatus] = useState<Prop_Firm_Sync_Status | null>(null);
  const [starting, setStarting] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const timer = useRef<number | null>(null);

  // O estado só muda nos callbacks, quando a resposta chega
  const load = () =>
    http
      .get<Prop_Firm_Sync_Status>(End_Points.Prop_Firms_Status_Endpoint())
      .then((response) => {
        setStatus(response.data);
        if (timer.current) window.clearTimeout(timer.current);
        timer.current = response.data.running ? window.setTimeout(load, POLL_MS) : null;
      })
      .catch(() => undefined);

  useEffect(() => {
    load();
    return () => {
      if (timer.current) window.clearTimeout(timer.current);
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  const start = async () => {
    setStarting(true);
    setError(null);
    try {
      const response = await http.post<Prop_Firm_Sync_Status>(End_Points.Prop_Firms_Sync_Endpoint());
      setStatus(response.data);
      timer.current = window.setTimeout(load, POLL_MS);
    } catch (err) {
      setError(getErrorMessage(err));
    } finally {
      setStarting(false);
    }
  };

  return { status, starting, error, start, refresh: load };
};

/** A base contra a API (lê a lista da API na hora; ~6 pedidos). */
export const fetchPropFirmCompare = () =>
  http.get<Prop_Firm_Compare>(End_Points.Prop_Firms_Compare_Endpoint()).then((response) => response.data);

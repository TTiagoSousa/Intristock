import { useCallback, useEffect, useState } from 'react';
import http from '../../Service/httpService';
import { End_Points } from '../../Service/endPoints';
import { getErrorMessage } from '../useAsyncRequest';

// As APIs com várias chaves (por agora a SerpApi, para os preços das motas)
export type Api_Key_Kind = 'motorcycle_prices';

/** Uma chave, sem o valor (nunca volta ao browser). */
export interface Api_Key {
  id: string;
  kind: Api_Key_Kind;
  label: string | null;
  // Os últimos 4 caracteres
  keyHint: string;
  position: number;
  monthlyLimit: number | null;
  usedThisMonth: number;
  remaining: number | null;
  checkedAt: string | null;
  // Esgotada até esta data (quando o plano renova)
  exhaustedUntil: string | null;
  active: boolean;
  lastUsedAt: string | null;
  lastError: string | null;
}

export interface Api_Keys_List {
  kind: Api_Key_Kind;
  provider: { label: string; docsUrl: string };
  keys: Api_Key[];
}

/**
 * As chaves de uma API: juntar (validada na API), mudar o nome, ligar/desligar, pôr por
 * ordem, apagar e ver as pesquisas de cada uma (o atualizar pergunta à API, não gasta).
 */
export const useApiKeys = (kind: Api_Key_Kind) => {
  const [list, setList] = useState<Api_Keys_List | null>(null);
  const [busy, setBusy] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    let cancelled = false;
    http
      .get<Api_Keys_List>(End_Points.Setup_Api_Keys_Endpoint(), { params: { kind } })
      .then(({ data }) => !cancelled && setList(data))
      .catch((err) => !cancelled && setError(getErrorMessage(err)));
    return () => {
      cancelled = true;
    };
  }, [kind]);

  const run = useCallback(async (key: string, action: () => Promise<void>) => {
    setBusy(key);
    setError(null);
    try {
      await action();
      return true;
    } catch (err) {
      setError(getErrorMessage(err));
      return false;
    } finally {
      setBusy(null);
    }
  }, []);

  const replaceKey = (updated: Api_Key) =>
    setList((current) => (current ? { ...current, keys: current.keys.map((key) => (key.id === updated.id ? updated : key)) } : current));

  const add = (key: string, label: string) =>
    run('add', async () => {
      const { data } = await http.post<Api_Key>(End_Points.Setup_Api_Keys_Endpoint(), { kind, key, label: label || undefined });
      setList((current) => (current ? { ...current, keys: [...current.keys, data] } : current));
    });

  const update = (id: string, body: { label?: string; active?: boolean }) =>
    run(id, async () => {
      const { data } = await http.patch<Api_Key>(End_Points.Setup_Api_Key_Endpoint(id), body);
      replaceKey(data);
    });

  const remove = (id: string) =>
    run(id, async () => {
      await http.delete(End_Points.Setup_Api_Key_Endpoint(id));
      setList((current) => (current ? { ...current, keys: current.keys.filter((key) => key.id !== id) } : current));
    });

  const move = (id: string, direction: -1 | 1) => {
    if (!list) return Promise.resolve(false);
    const ids = list.keys.map((key) => key.id);
    const index = ids.indexOf(id);
    const target = index + direction;
    if (index < 0 || target < 0 || target >= ids.length) return Promise.resolve(false);
    [ids[index], ids[target]] = [ids[target], ids[index]];
    // Já no sítio novo enquanto o servidor grava; se falhar, volta à ordem de antes
    const previous = list;
    setList({ ...list, keys: ids.map((key) => list.keys.find((row) => row.id === key)!) });
    return run(id, async () => {
      try {
        const { data } = await http.post<Api_Keys_List>(End_Points.Setup_Api_Keys_Reorder_Endpoint(), { kind, ids });
        setList(data);
      } catch (err) {
        setList(previous);
        throw err;
      }
    });
  };

  const refresh = () =>
    run('refresh', async () => {
      const { data } = await http.post<Api_Keys_List>(End_Points.Setup_Api_Keys_Refresh_Endpoint(), null, { params: { kind } });
      setList(data);
    });

  return { list, busy, error, add, update, remove, move, refresh };
};

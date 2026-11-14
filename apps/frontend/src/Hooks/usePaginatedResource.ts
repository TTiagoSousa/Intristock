import { useCallback, useEffect, useRef, useState } from 'react';
import http from '../Service/httpService';
import { useAlert } from '../Contexts/Alert_Context';
import { getErrorMessage } from './useAsyncRequest';

/** Dez por página, e cada página é um pedido ao servidor. */
export const PAGE_SIZE = 10;

interface Page<T> {
  items: T[];
  total: number;
}

/**
 * Uma lista paginada pelo servidor.
 *
 * A página 2 vai buscar os dez seguintes; a app nunca traz a tabela toda para
 * cortar no ecrã. É o que faz uma empresa com milhares de linhas abrir tão
 * depressa como uma com dez.
 *
 * Ao mudar de página as linhas anteriores **ficam à vista**, só mais apagadas
 * — a tabela não desaparece nem muda de altura enquanto o pedido não chega.
 */
export const usePaginatedResource = <T,>(
  endpoint: string | undefined,
  // Filtros que, ao mudarem, mandam a lista de volta à página 1
  params: Record<string, string | undefined> = {},
) => {
  const [items, setItems] = useState<T[]>([]);
  const [total, setTotal] = useState(0);
  const [extra, setExtra] = useState<Record<string, unknown>>({});
  const [page, setPage] = useState(1);
  // A primeira carga tem o ecrã vazio; as seguintes já têm linhas à vista
  const [loading, setLoading] = useState(true);
  const [loadingPage, setLoadingPage] = useState(false);

  const hasLoadedOnce = useRef(false);
  // Cada pedido leva um número. Se entretanto sair outro — ou se mudar de
  // empresa — a resposta antiga chega e é deitada fora, senão via-se a lista
  // da empresa anterior.
  const requestToken = useRef(0);

  const { setAlert } = useAlert();

  const paramsKey = JSON.stringify(params);
  const totalPages = Math.max(1, Math.ceil(total / PAGE_SIZE));
  const safePage = Math.min(page, totalPages);

  const load = useCallback(
    async (targetPage: number) => {
      if (!endpoint) return;

      const token = ++requestToken.current;

      hasLoadedOnce.current ? setLoadingPage(true) : setLoading(true);

      try {
        const { data } = await http.get<Page<T>>(endpoint, {
          params: {
            skip: (targetPage - 1) * PAGE_SIZE,
            take: PAGE_SIZE,
            ...JSON.parse(paramsKey),
          },
        });

        if (token !== requestToken.current) return;

        const { items: rows, total: count, ...rest } = data;

        setItems(rows);
        setTotal(count);
        // Somas de toda a lista que o backend mande junto — um total calculado
        // sobre as dez linhas à vista seria um número errado com outro nome
        setExtra(rest);
        hasLoadedOnce.current = true;
      } catch (error) {
        if (token === requestToken.current) {
          setAlert({ open: true, message: getErrorMessage(error), type: 'error' });
        }
      } finally {
        // Uma resposta atrasada não pode desligar o carregamento da seguinte
        if (token === requestToken.current) {
          setLoading(false);
          setLoadingPage(false);
        }
      }
    },
    // eslint-disable-next-line react-hooks/exhaustive-deps
    [endpoint, paramsKey],
  );

  // Trocar de empresa ou de filtro manda a lista de volta ao princípio: a
  // página 4 de uma lista pode não existir na seguinte
  useEffect(() => {
    requestToken.current += 1;
    hasLoadedOnce.current = false;

    setItems([]);
    setTotal(0);
    setPage(1);
    setLoading(true);
    setLoadingPage(false);

    load(1);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [endpoint, paramsKey]);

  useEffect(() => {
    if (hasLoadedOnce.current) load(safePage);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [safePage]);

  /**
   * Voltar a pedir a página onde estamos.
   *
   * Chama-se depois de criar, editar ou apagar: com o servidor a paginar, o
   * que mudou pode ter empurrado linhas de uma página para a outra, e mexer na
   * lista local deixava o ecrã a discordar da base de dados.
   */
  const refresh = useCallback(() => load(safePage), [load, safePage]);

  return {
    items,
    total,
    // Somas de toda a lista que o backend mandou junto com a página
    extra,
    page: safePage,
    setPage,
    totalPages,
    pageSize: PAGE_SIZE,
    loading,
    loadingPage,
    refresh,
  };
};

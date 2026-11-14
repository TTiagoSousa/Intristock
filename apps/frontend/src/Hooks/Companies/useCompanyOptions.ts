import { useCallback, useEffect, useState } from 'react';
import http from '../../Service/httpService';
import { End_Points } from '../../Service/endPoints';
import { useAsyncRequest } from '../useAsyncRequest';
import type { CompanySupplier } from './useCompanySuppliers';
import type { CompanyItem } from './useCompanyItems';
import type { CompanySupplierGroup } from './useCompanySupplierGroups';

/**
 * As listas que enchem os dropdowns dos formulários.
 *
 * São leituras diferentes das das tabelas, e por isso vivem à parte: a tabela
 * mostra dez de cada vez porque quem lê não quer mil linhas de uma vez, mas um
 * dropdown com dez fornecedores só deixaria escolher dez. Aqui vêm todos até ao
 * teto que o backend aceita.
 *
 * A partir de umas centenas isto deixa de servir e o dropdown passa a precisar
 * de pesquisa contra o servidor — o `Global_Dropdown` já pesquisa, mas só
 * dentro do que recebeu.
 */
const OPTIONS_TAKE = 100;

const useOptions = <T,>(endpoint: string | undefined) => {
  const [options, setOptions] = useState<T[]>([]);

  const { loading, run } = useAsyncRequest(true);

  const refresh = useCallback(async () => {
    if (!endpoint) return;

    const response = await run(() => http.get(endpoint, { params: { take: OPTIONS_TAKE } }));

    // A resposta é paginada como a das tabelas — aqui só interessam as linhas
    if (response) setOptions(response.data.items ?? response.data);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [endpoint]);

  useEffect(() => {
    refresh();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [endpoint]);

  return { options, loading, refresh };
};

export const useCompanySupplierOptions = (companyId: string | undefined) => {
  const { options, loading, refresh } = useOptions<CompanySupplier>(
    companyId ? End_Points.Company_Suppliers_Endpoint(companyId) : undefined,
  );

  return { suppliers: options, loading, refresh };
};

export const useCompanyItemOptions = (companyId: string | undefined) => {
  const { options, loading, refresh } = useOptions<CompanyItem>(
    companyId ? End_Points.Company_Items_Endpoint(companyId) : undefined,
  );

  return { items: options, loading, refresh };
};

export const useCompanySupplierGroupOptions = (companyId: string | undefined) => {
  const { options, loading, refresh } = useOptions<CompanySupplierGroup>(
    companyId ? End_Points.Company_Supplier_Groups_Endpoint(companyId) : undefined,
  );

  return { groups: options, loading, refresh };
};

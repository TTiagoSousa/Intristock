import { useState } from 'react';

/**
 * Uma lista que já veio toda do backend, mostrada às páginas de `pageSize`
 * linhas. Se a lista encolher (um filtro, uma linha apagada), a página volta à
 * última que existe.
 */
export const usePagedList = <T>(items: T[] | null | undefined, pageSize = 5) => {
  const [page, setPage] = useState(1);
  const total = items?.length ?? 0;
  const totalPages = Math.max(1, Math.ceil(total / pageSize));
  const current = Math.min(page, totalPages);
  const pageItems = (items ?? []).slice((current - 1) * pageSize, current * pageSize);
  return { page: current, setPage, totalPages, total, pageSize, pageItems };
};

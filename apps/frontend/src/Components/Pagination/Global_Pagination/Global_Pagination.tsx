import { useTranslation } from 'react-i18next';
import { Chevron_Left, Chevron_Right, Chevrons_Left, Chevrons_Right } from '../../../Imports/icons';
import './Global_Pagination.scss';

interface Global_Pagination_Props {
  // Página atual, a começar em 1
  page: number;
  totalPages: number;
  onPageChange: (page: number) => void;
  // Só para o resumo "1–10 de 42". Sem eles, o resumo não aparece
  totalItems?: number;
  pageSize?: number;
  // Quantos números aparecem ao todo, já a contar com a primeira e a última
  maxPageButtons?: number;
}

// Reticências na lista de páginas. Não é um número para não colidir com uma
// página real.
const GAP = 'gap' as const;

type Page_Item = number | typeof GAP;

/**
 * Que números mostrar. Aparecem **sempre `maxPageButtons` números**, nem mais
 * nem menos: a primeira, a última, e uma janela à volta da atual a preencher o
 * resto. O que fica de fora vira reticências — com 200 páginas não se desenham
 * 200 botões.
 *
 * As reticências só aparecem quando há mesmo páginas escondidas: os números
 * ficam sempre encostados uns aos outros. Chegou a haver um espaço reservado
 * para elas, para a barra nunca mudar de largura, mas isso deixava um buraco à
 * vista nas páginas do fim — e o buraco incomoda mais do que a barra encolher.
 */
const buildPages = (page: number, totalPages: number, maxPageButtons: number): Page_Item[] => {
  if (totalPages <= maxPageButtons) {
    return Array.from({ length: totalPages }, (_, index) => index + 1);
  }

  // Dois lugares são da primeira e da última página; o resto é a janela
  const windowSize = maxPageButtons - 2;
  const half = Math.floor(windowSize / 2);

  let start = Math.max(2, page - half);
  let end = start + windowSize - 1;

  // Perto do fim, a janela empurra-se para trás em vez de encolher
  if (end >= totalPages) {
    end = totalPages - 1;
    start = Math.max(2, end - windowSize + 1);
  }

  const pages: Page_Item[] = [1];

  if (start > 2) pages.push(GAP);

  for (let current = start; current <= end; current++) pages.push(current);

  if (end < totalPages - 1) pages.push(GAP);

  pages.push(totalPages);

  return pages;
};

const Global_Pagination = ({
  page,
  totalPages,
  onPageChange,
  totalItems,
  pageSize,
  maxPageButtons = 5,
}: Global_Pagination_Props) => {
  const { t } = useTranslation();

  // Com uma página só não há nada para navegar
  if (totalPages <= 1) return null;

  const goTo = (target: number) => {
    const clamped = Math.min(Math.max(target, 1), totalPages);

    if (clamped !== page) onPageChange(clamped);
  };

  const isFirst = page <= 1;
  const isLast = page >= totalPages;

  const summary =
    totalItems !== undefined && pageSize !== undefined
      ? t('pagination.summary', {
          from: (page - 1) * pageSize + 1,
          to: Math.min(page * pageSize, totalItems),
          total: totalItems,
        })
      : null;

  return (
    <div className="Global_Pagination">
      {summary && <span className="Pagination_Summary">{summary}</span>}

      <div className="Pagination_Controls">
        <button
          type="button"
          className="Pagination_Arrow"
          onClick={() => goTo(1)}
          disabled={isFirst}
          title={t('pagination.first')}
          aria-label={t('pagination.first')}
        >
          <Chevrons_Left />
        </button>

        <button
          type="button"
          className="Pagination_Arrow"
          onClick={() => goTo(page - 1)}
          disabled={isFirst}
          title={t('pagination.previous')}
          aria-label={t('pagination.previous')}
        >
          <Chevron_Left />
        </button>

        <div className="Pagination_Pages">
          {buildPages(page, totalPages, maxPageButtons).map((item, index) =>
            item === GAP ? (
              // A chave usa o índice porque uma reticência não tem identidade
              <span key={`gap-${index}`} className="Pagination_Gap" aria-hidden="true">
                …
              </span>
            ) : (
              <button
                key={item}
                type="button"
                className={`Pagination_Page ${item === page ? 'Active' : ''}`}
                onClick={() => goTo(item)}
                aria-current={item === page ? 'page' : undefined}
              >
                {item}
              </button>
            ),
          )}
        </div>

        <button
          type="button"
          className="Pagination_Arrow"
          onClick={() => goTo(page + 1)}
          disabled={isLast}
          title={t('pagination.next')}
          aria-label={t('pagination.next')}
        >
          <Chevron_Right />
        </button>

        <button
          type="button"
          className="Pagination_Arrow"
          onClick={() => goTo(totalPages)}
          disabled={isLast}
          title={t('pagination.last')}
          aria-label={t('pagination.last')}
        >
          <Chevrons_Right />
        </button>
      </div>
    </div>
  );
};

export default Global_Pagination;

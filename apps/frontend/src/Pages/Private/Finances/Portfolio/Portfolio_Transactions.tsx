import { useMemo, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { useTranslation } from 'react-i18next';
import { useDayRates } from '../../../../Hooks/Finances/useDayRates';
import { useCurrency } from '../../../../Contexts/Currency_Context';
import { useCurrencyFormat } from '../../../../Hooks/useCurrencyFormat';
import {
  EMPTY_TRANSACTION_FILTERS,
  TRANSACTION_KINDS,
  usePortfolioTransactions,
  type Portfolio_Transaction_Filters,
} from '../../../../Hooks/Finances/usePersonalPortfolio';
import Global_Input from '../../../../Components/Inputs/Global_Input/Global_Input';
import Global_Dropdown from '../../../../Components/Inputs/Global_Dropdown/Global_Dropdown';
import Global_Pagination from '../../../../Components/Pagination/Global_Pagination/Global_Pagination';
import { Transaction_Amount, Transaction_Asset } from './Transaction_Amount';
import { formatDay, localeOf } from '../Earnings/earningsLabels';
import Platform_Badge from './Platform_Badge';
import Goods_Popover from './Goods/Goods_Popover';
import '../Earnings/Earnings.scss';
import './Portfolio.scss';

const PAGE_SIZE = 20;

/**
 * Todas as transações da pessoa, de todos os portefólios: os filtros num cartão à
 * parte (datas, origem — manual ou de uma corretora —, plataforma, portefólio,
 * ativo e tipo) e a lista às páginas, na moeda do topo à cotação do dia de cada uma.
 * O servidor dá uma página de cada vez, quantas são e o saldo de todas.
 */
const Portfolio_Transactions = () => {
  const { t, i18n } = useTranslation();
  const navigate = useNavigate();
  const locale = localeOf(i18n.language);
  const { currencies, selectedCurrency } = useCurrency();
  const { formatIn } = useCurrencyFormat();
  const currencyId = currencies.find((currency) => currency.shortCode === selectedCurrency)?.id ?? '';
  const [filters, setFilters] = useState<Portfolio_Transaction_Filters>(EMPTY_TRANSACTION_FILTERS);
  const [page, setPage] = useState(1);
  // A mota aberta (o painel dela)
  const [goodsId, setGoodsId] = useState<string | null>(null);
  const { data, assets, portfolios, error } = usePortfolioTransactions(filters, page, PAGE_SIZE, currencyId);
  const transactions = data?.transactions ?? null;
  // Só as da página se convertem no browser
  const rated = useDayRates(
    (transactions ?? []).map((tx) => ({ currency: tx.currency, date: tx.date.slice(0, 10) })),
  );

  // Um filtro novo volta à primeira página
  const changeFilters = (next: Portfolio_Transaction_Filters) => {
    setFilters(next);
    setPage(1);
  };
  const setFilter = (key: keyof Portfolio_Transaction_Filters, value: string) =>
    changeFilters({ ...filters, [key]: value });
  const filtered = Object.values(filters).some(Boolean);

  // As plataformas dos portefólios ligados, para o filtro
  const platforms = useMemo(() => {
    const byId = new Map<string, string>();
    for (const portfolio of portfolios) if (portfolio.platform) byId.set(portfolio.platform.id, portfolio.platform.name);
    return [...byId.entries()].map(([value, label]) => ({ value, label }));
  }, [portfolios]);

  // O que entrou menos o que saiu de todas (não só da página), na moeda do topo
  const net = data ? formatIn(data.net, data.currency?.shortCode ?? selectedCurrency) : '';
  const total = data?.total ?? 0;
  const totalPages = Math.max(1, Math.ceil(total / PAGE_SIZE));

  return (
    <div className="Earnings">
      {error && <span className="Earnings_Message Bad">{error}</span>}

      <div className="Card Earnings_Filter_Card">
        <div className="Earnings_Filters Portfolio_Filters">
          <div className="Earnings_Filter">
            <span className="Eyebrow">{t('portfolio.filterFrom')}</span>
            <Global_Input id="portfolio-filter-from" type="date" value={filters.from} onChange={(e) => setFilter('from', e.target.value)} />
          </div>
          <div className="Earnings_Filter">
            <span className="Eyebrow">{t('portfolio.filterTo')}</span>
            <Global_Input id="portfolio-filter-to" type="date" value={filters.to} onChange={(e) => setFilter('to', e.target.value)} />
          </div>
          <div className="Earnings_Filter">
            <span className="Eyebrow">{t('portfolio.filterSource')}</span>
            <div className="Tabs">
              {(['', 'manual', 'api'] as const).map((source) => (
                <button
                  key={source || 'all'}
                  type="button"
                  className={filters.source === source ? 'Active' : ''}
                  onClick={() => setFilter('source', source)}
                >
                  {source ? t(`portfolio.source_${source}`) : t('portfolio.all')}
                </button>
              ))}
            </div>
          </div>
          <div className="Earnings_Filter">
            <span className="Eyebrow">{t('portfolio.filterPlatform')}</span>
            <Global_Dropdown
              id="portfolio-filter-platform"
              value={filters.platformId}
              onChange={(value) => setFilter('platformId', String(value))}
              options={[{ value: '', label: t('portfolio.all') }, ...platforms]}
            />
          </div>
          <div className="Earnings_Filter">
            <span className="Eyebrow">{t('portfolio.filterPortfolio')}</span>
            <Global_Dropdown
              id="portfolio-filter-portfolio"
              value={filters.portfolioId}
              onChange={(value) => setFilter('portfolioId', String(value))}
              options={[
                { value: '', label: t('portfolio.all') },
                ...portfolios.map((portfolio) => ({ value: portfolio.id, label: portfolio.name })),
              ]}
            />
          </div>
          <div className="Earnings_Filter">
            <span className="Eyebrow">{t('portfolio.filterAsset')}</span>
            <Global_Dropdown
              id="portfolio-filter-asset"
              value={filters.assetId}
              onChange={(value) => setFilter('assetId', String(value))}
              options={[
                { value: '', label: t('portfolio.all') },
                ...assets.map((asset) => ({ value: asset.id, label: asset.ticker ? `${asset.ticker} · ${asset.name}` : asset.name })),
              ]}
            />
          </div>
          <div className="Earnings_Filter">
            <span className="Eyebrow">{t('portfolio.filterKind')}</span>
            <Global_Dropdown
              id="portfolio-filter-kind"
              value={filters.kind}
              onChange={(value) => setFilter('kind', String(value))}
              options={[
                { value: '', label: t('portfolio.all') },
                ...TRANSACTION_KINDS.map((kind) => ({ value: kind, label: t(`portfolio.kind_${kind}`) })),
              ]}
            />
          </div>
          {filtered && (
            <button type="button" className="Earnings_Clear" onClick={() => changeFilters(EMPTY_TRANSACTION_FILTERS)}>
              {t('purchasesDashboard.clear')}
            </button>
          )}
        </div>
      </div>

      <div className="Card Earnings_Card">
        <div className="Card_Header">
          <div className="Card_Header_Text">
            <span className="Card_Title">{t('portfolio.transactionsTitle')}</span>
            <span className="Card_Subtitle">
              {total > 0
                ? t('portfolio.transactionsSummary', { count: total, net }) +
                  (data?.estimatedRates ? t('finances.ratesEstimated', { count: data.estimatedRates }) : '')
                : t('portfolio.transactionsSubtitle')}
            </span>
          </div>
        </div>
        <div className="Earnings_Body">
          {!transactions ? (
            <span className="Earnings_Message">{t('common.loading')}</span>
          ) : total === 0 ? (
            <div className="Empty_State">
              <span className="Empty_State_Title">{t(filtered ? 'portfolio.transactionsNoMatch' : 'portfolio.transactionsEmpty')}</span>
              {!filtered && <span className="Empty_State_Text">{t('portfolio.emptyText')}</span>}
            </div>
          ) : (
            <>
              <div className="Table_Wrap">
                <table className="Table">
                  <thead>
                    <tr>
                      <th>{t('portfolio.date')}</th>
                      <th>{t('portfolio.portfolioColumn')}</th>
                      <th>{t('portfolio.assetColumn')}</th>
                      <th>{t('portfolio.kindColumn')}</th>
                      <th>{t('portfolio.notes')}</th>
                      <th className="Right">{t('portfolio.amount')}</th>
                    </tr>
                  </thead>
                  <tbody>
                    {transactions.map((tx) => (
                      <tr
                        key={tx.id}
                        className={tx.asset.subClass === 'vehicle' ? 'Clickable' : undefined}
                        onClick={tx.asset.subClass === 'vehicle' ? () => setGoodsId(tx.asset.id) : undefined}
                      >
                        <td className="Num">{formatDay(tx.date.slice(0, 10), locale)}</td>
                        <td>
                          <button
                            type="button"
                            className="Portfolio_Link"
                            onClick={(event) => {
                              event.stopPropagation();
                              navigate(`/Portefolio/p/${tx.portfolioId}`);
                            }}
                          >
                            <Platform_Badge platform={tx.portfolio?.platform ?? null} />
                            {tx.portfolio?.name}
                          </button>
                        </td>
                        <Transaction_Asset tx={tx} />
                        <td>{t(`portfolio.kind_${tx.kind}`)}</td>
                        <td className="Portfolio_Muted">{tx.notes ?? (tx.externalType && tx.externalType !== 'in_kind' ? t('portfolio.fromBroker') : '—')}</td>
                        <Transaction_Amount tx={tx} rated={rated} />
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
              <Global_Pagination
                page={page}
                totalPages={totalPages}
                onPageChange={setPage}
                totalItems={total}
                pageSize={PAGE_SIZE}
              />
            </>
          )}
        </div>
      </div>
      {goodsId && <Goods_Popover assetId={goodsId} onClose={() => setGoodsId(null)} />}
    </div>
  );
};

export default Portfolio_Transactions;

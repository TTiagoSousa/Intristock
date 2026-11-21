import { useMemo, useState } from 'react';
import { useNavigate, useParams } from 'react-router';
import { useTranslation } from 'react-i18next';
import { useCurrency } from '../../../../Contexts/Currency_Context';
import { useCurrencyFormat } from '../../../../Hooks/useCurrencyFormat';
import { useBreadcrumbSegmentLabel } from '../../../../Contexts/Breadcrumb_Context';
import { useDayRates } from '../../../../Hooks/Finances/useDayRates';
import {
  KIND_SIGN,
  POSITION_KINDS,
  usePortfolioDetail,
  usePortfolioPositions,
  type Portfolio_Transaction,
} from '../../../../Hooks/Finances/usePersonalPortfolio';
import Global_Pagination from '../../../../Components/Pagination/Global_Pagination/Global_Pagination';
import { usePagedList } from '../../../../Hooks/usePagedList';
import { formatDay, localeOf } from '../Earnings/earningsLabels';
import Platform_Badge from './Platform_Badge';
import Goods_Popover from './Goods/Goods_Popover';
import { Transaction_Amount, Transaction_Asset } from './Transaction_Amount';
import '../Earnings/Earnings.scss';
import './Portfolio.scss';
import { activateOnKey } from '../../../../utils/rowKeyboard';

const day = (tx: Portfolio_Transaction) => tx.date.slice(0, 10);
const signed = (tx: Portfolio_Transaction) => (KIND_SIGN[tx.kind] ?? 0) * Number(tx.amount);
const quantityFormat = new Intl.NumberFormat(undefined, { maximumFractionDigits: 6 });

/**
 * Um portefólio. No de dinheiro: o saldo de hoje, os juros, o que entrou e saiu, as
 * comissões e os juros de cada mês. No de ações: o valor das posições, o custo, o ganho
 * por realizar e o realizado, e as posições ao último fecho. Nos dois, as últimas
 * transações. Os de uma corretora são só de leitura e dizem quando se sincronizaram.
 */
const Portfolio_Page = () => {
  const { portfolioId = '' } = useParams();
  const { t, i18n } = useTranslation();
  const navigate = useNavigate();
  const { formatIn } = useCurrencyFormat();
  const { selectedCurrency } = useCurrency();
  const locale = localeOf(i18n.language);
  const { portfolio, transactions, error } = usePortfolioDetail(portfolioId);
  const positions = usePortfolioPositions(portfolioId);
  // A mota aberta (o painel dela)
  const [goodsId, setGoodsId] = useState<string | null>(null);
  useBreadcrumbSegmentLabel(portfolioId, portfolio?.name);
  const list = useMemo(() => transactions ?? [], [transactions]);
  const page = usePagedList(transactions, 10);
  const holdsPositions = list.some((tx) => POSITION_KINDS.includes(tx.kind));

  // Os juros de cada mês, do mais recente, na moeda de cada um
  const interestMonths = useMemo(() => {
    const byMonth = new Map<string, Portfolio_Transaction[]>();
    for (const tx of list)
      if (tx.kind === 'interest') byMonth.set(day(tx).slice(0, 7), [...(byMonth.get(day(tx).slice(0, 7)) ?? []), tx]);
    return [...byMonth.entries()].sort((a, b) => b[0].localeCompare(a[0]));
  }, [list]);
  const monthsPage = usePagedList(interestMonths, 12);

  // O dinheiro de cada moeda, para o de hoje (sem dia: à cotação de hoje)
  const balances = useMemo(() => {
    const byCurrency = new Map<string, { currency: Portfolio_Transaction['currency']; amount: number }>();
    for (const tx of list) {
      if (!(tx.kind in KIND_SIGN)) continue;
      const current = byCurrency.get(tx.currency.id) ?? { currency: tx.currency, amount: 0 };
      current.amount += signed(tx);
      byCurrency.set(tx.currency.id, current);
    }
    return [...byCurrency.values()].filter((item) => Math.abs(item.amount) >= 0.005);
  }, [list]);

  const open = useMemo(() => (positions ?? []).filter((position) => position.quantity), [positions]);
  const rated = useDayRates([
    ...list.map((tx) => ({ currency: tx.currency, date: day(tx) })),
    ...balances.map((item) => ({ currency: item.currency })),
    ...(positions ?? []).flatMap((position) => [
      { currency: position.currency },
      ...(position.price ? [{ currency: position.price.currency }] : []),
    ]),
  ]);
  const sumOf = (kinds: string[]) =>
    rated.total(
      list.filter((tx) => kinds.includes(tx.kind)).map((tx) => ({ amount: Number(tx.amount), currency: tx.currency, date: day(tx) })),
    );
  const balanceTotal = rated.total(balances.map((item) => ({ amount: item.amount, currency: item.currency })));

  // As posições na moeda do topo, à cotação de hoje: o valor (sem fecho, pelo custo), o
  // custo e a diferença
  const valued = (positions ?? []).map((position) => {
    const value = position.price && position.value !== null
      ? rated.convert(position.value, position.price.currency)
      : position.goods && position.value !== null
        ? rated.convert(position.value, position.currency)
        : rated.convert(position.cost, position.currency);
    const cost = rated.convert(position.cost, position.currency);
    const realized = rated.convert(position.realized, position.currency);
    return { position, value, cost, realized, gain: value !== null && cost !== null ? value - cost : null };
  });
  const sum = (values: (number | null)[]) =>
    values.some((value) => value === null) ? null : values.reduce<number>((total, value) => total + (value ?? 0), 0);
  const openValued = valued.filter((row) => row.position.quantity);
  const totals = {
    value: sum(openValued.map((row) => row.value)),
    cost: sum(openValued.map((row) => row.cost)),
    gain: sum(openValued.map((row) => row.gain)),
    realized: sum(valued.map((row) => row.realized)),
  };
  const money = (value: number | null) => (value === null ? '—' : formatIn(value, selectedCurrency));
  const tone = (value: number | null) => (value === null || Math.abs(value) < 0.005 ? '' : value > 0 ? 'Portfolio_In' : 'Portfolio_Loss');

  const monthLabel = (month: string) =>
    new Date(`${month}-01T00:00:00Z`).toLocaleDateString(locale, { month: 'long', year: 'numeric', timeZone: 'UTC' });
  const syncedAt = portfolio?.syncedAt
    ? new Date(portfolio.syncedAt).toLocaleString(locale, { dateStyle: 'short', timeStyle: 'short' })
    : null;

  if (error) return <span className="Earnings_Message Bad">{error}</span>;
  if (transactions && !portfolio)
    return (
      <div className="Empty_State">
        <span className="Empty_State_Title">{t('portfolio.notFound')}</span>
      </div>
    );

  return (
    <div className="Earnings">
      <div className="Card Portfolio_Head">
        <div className="Portfolio_Head_Title">
          <Platform_Badge platform={portfolio?.platform ?? null} />
          <span className="Card_Title">{portfolio?.name ?? '…'}</span>
          {portfolio?.source === 'api' && <span className="Pill Info">{t('portfolio.readOnly')}</span>}
        </div>
        <span className="Card_Subtitle">
          {portfolio?.source === 'api'
            ? [portfolio.platform?.name, syncedAt ? t('portfolio.syncedAt', { when: syncedAt }) : t('portfolio.neverSynced')]
                .filter(Boolean)
                .join(' · ')
            : t('portfolio.manualPortfolio')}
        </span>
      </div>

      {holdsPositions ? (
        <div className="Portfolio_Stats">
          <div className="Card Portfolio_Stat">
            <span className="Portfolio_Stat_Label">{t('portfolio.investedValue')}</span>
            <span className="Portfolio_Stat_Value Num">{money(totals.value)}</span>
            <span className="Portfolio_Stat_Sub">{t('portfolio.positionCount', { count: open.length })}</span>
          </div>
          <div className="Card Portfolio_Stat">
            <span className="Portfolio_Stat_Label">{t('portfolio.investedCost')}</span>
            <span className="Portfolio_Stat_Value Num">{money(totals.cost)}</span>
            <span className="Portfolio_Stat_Sub">{t('portfolio.investedCostHint')}</span>
          </div>
          <div className="Card Portfolio_Stat">
            <span className="Portfolio_Stat_Label">{t('portfolio.unrealized')}</span>
            <span className={`Portfolio_Stat_Value Num ${tone(totals.gain)}`}>{money(totals.gain)}</span>
            <span className="Portfolio_Stat_Sub">{t('portfolio.unrealizedHint')}</span>
          </div>
          <div className="Card Portfolio_Stat">
            <span className="Portfolio_Stat_Label">{t('portfolio.realized')}</span>
            <span className={`Portfolio_Stat_Value Num ${tone(totals.realized)}`}>{money(totals.realized)}</span>
            <span className="Portfolio_Stat_Sub">{t('portfolio.realizedHint')}</span>
          </div>
        </div>
      ) : (
        <div className="Portfolio_Stats">
          <div className="Card Portfolio_Stat">
            <span className="Portfolio_Stat_Label">{t('portfolio.balanceNow')}</span>
            <span className="Portfolio_Stat_Value Num">{balances.length ? balanceTotal : '—'}</span>
            {balances.length > 1 && (
              <span className="Portfolio_Stat_Sub Num">
                {balances.map((item) => formatIn(item.amount, item.currency)).join(' · ')}
              </span>
            )}
          </div>
          <div className="Card Portfolio_Stat">
            <span className="Portfolio_Stat_Label">{t('portfolio.interestEarned')}</span>
            <span className="Portfolio_Stat_Value Num Portfolio_In">{sumOf(['interest'])}</span>
            <span className="Portfolio_Stat_Sub">
              {t('portfolio.interestCount', { count: list.filter((tx) => tx.kind === 'interest').length })}
            </span>
          </div>
          <div className="Card Portfolio_Stat">
            <span className="Portfolio_Stat_Label">{t('portfolio.depositsTotal')}</span>
            <span className="Portfolio_Stat_Value Num">{sumOf(['deposit'])}</span>
            <span className="Portfolio_Stat_Sub">{t('portfolio.withdrawalsTotal', { amount: sumOf(['withdrawal']) })}</span>
          </div>
          <div className="Card Portfolio_Stat">
            <span className="Portfolio_Stat_Label">{t('portfolio.costsTotal')}</span>
            <span className="Portfolio_Stat_Value Num">{sumOf(['fee', 'tax'])}</span>
            <span className="Portfolio_Stat_Sub">{t('portfolio.costsHint')}</span>
          </div>
        </div>
      )}

      {holdsPositions && (
        <div className="Card Earnings_Card">
          <div className="Card_Header">
            <div className="Card_Header_Text">
              <span className="Card_Title">{t('portfolio.positionsTitle')}</span>
              <span className="Card_Subtitle">{t('portfolio.positionsSubtitle')}</span>
            </div>
          </div>
          <div className="Earnings_Body">
            {!positions ? (
              <span className="Earnings_Message">{t('common.loading')}</span>
            ) : positions.length === 0 ? (
              <div className="Empty_State">
                <span className="Empty_State_Title">{t('portfolio.positionsEmpty')}</span>
              </div>
            ) : (
              <div className="Table_Wrap">
                <table className="Table">
                  <thead>
                    <tr>
                      <th>{t('portfolio.assetColumnTicker')}</th>
                      <th className="Right">{t('portfolio.quantity')}</th>
                      <th className="Right">{t('portfolio.averageCost')}</th>
                      <th className="Right">{t('portfolio.lastClose')}</th>
                      <th className="Right">{t('portfolio.value')}</th>
                      <th className="Right">{t('portfolio.unrealized')}</th>
                      <th className="Right">{t('portfolio.realized')}</th>
                    </tr>
                  </thead>
                  <tbody>
                    {valued.map(({ position, value, gain, realized }) => (
                      <tr
                        key={position.symbol ?? position.asset.id}
                        className={[position.quantity ? '' : 'Portfolio_Closed', position.goods ? 'Clickable' : ''].join(' ').trim()}
                        onClick={position.goods ? () => setGoodsId(position.asset.id) : undefined} tabIndex={position.goods ? 0 : undefined} onKeyDown={activateOnKey}
                      >
                        <td>
                          <span className="Earnings_Strong">{position.asset.name}</span>
                          <div className="Earnings_Sub">
                            {[position.symbol, position.quantity ? null : t('portfolio.closedPosition')].filter(Boolean).join(' · ')}
                          </div>
                        </td>
                        <td className="Right Num">{quantityFormat.format(position.quantity)}</td>
                        <td className="Right Num">
                          {position.averageCost !== null ? formatIn(position.averageCost, position.currency) : '—'}
                        </td>
                        <td className="Right Num">
                          {/* O fecho vem na cotada do mercado: os pence (GBX) passam a libras e as
                              stablecoins vão na moeda que o servidor já resolveu (USDT → USD) */}
                          {position.price
                            ? formatIn(
                                position.price.quote === 'GBX' ? position.price.close / 100 : position.price.close,
                                position.price.currency,
                              )
                            : position.goods && position.value !== null
                              ? formatIn(position.value, position.currency)
                              : t('portfolio.noPrice')}
                          {position.goods && <div className="Earnings_Sub">{t('goods.valuedLabel')}</div>}
                          {position.price && (
                            <div className="Earnings_Sub">
                              {t('portfolio.priceFrom', {
                                symbol: position.priceSymbol,
                                date: formatDay(position.price.date.slice(0, 10), locale),
                              })}
                            </div>
                          )}
                        </td>
                        <td className="Right Num">{position.quantity ? money(value) : '—'}</td>
                        <td className={`Right Num ${tone(position.quantity ? gain : null)}`}>
                          {position.quantity ? money(gain) : '—'}
                        </td>
                        <td className={`Right Num ${tone(realized)}`}>{money(realized)}</td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            )}
          </div>
        </div>
      )}

      {interestMonths.length > 0 && (
        <div className="Card Earnings_Card">
          <div className="Card_Header">
            <div className="Card_Header_Text">
              <span className="Card_Title">{t('portfolio.interestTitle')}</span>
              <span className="Card_Subtitle">{t('portfolio.interestSubtitle')}</span>
            </div>
          </div>
          <div className="Earnings_Body">
            <div className="Table_Wrap">
              <table className="Table">
                <thead>
                  <tr>
                    <th>{t('portfolio.month')}</th>
                    <th className="Right">{t('portfolio.payments')}</th>
                    <th className="Right">{t('portfolio.interestColumn')}</th>
                  </tr>
                </thead>
                <tbody>
                  {monthsPage.pageItems.map(([month, items]) => (
                    <tr key={month}>
                      <td className="Portfolio_Capitalize">{monthLabel(month)}</td>
                      <td className="Right Num">{items.length}</td>
                      <td className="Right Num Portfolio_In">
                        {rated.total(items.map((tx) => ({ amount: Number(tx.amount), currency: tx.currency, date: day(tx) })))}
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
            <Global_Pagination
              page={monthsPage.page}
              totalPages={monthsPage.totalPages}
              onPageChange={monthsPage.setPage}
              totalItems={monthsPage.total}
              pageSize={monthsPage.pageSize}
            />
          </div>
        </div>
      )}

      <div className="Card Earnings_Card">
        <div className="Card_Header">
          <div className="Card_Header_Text">
            <span className="Card_Title">{t('portfolio.latestTitle')}</span>
            <span className="Card_Subtitle">{t('portfolio.transactionCount', { count: list.length })}</span>
          </div>
          <div className="Earnings_Controls">
            <button type="button" className="Earnings_Clear" onClick={() => navigate('/Portefolio/transacoes')}>
              {t('portfolio.seeAll')}
            </button>
          </div>
        </div>
        <div className="Earnings_Body">
          {!transactions ? (
            <span className="Earnings_Message">{t('common.loading')}</span>
          ) : list.length === 0 ? (
            <div className="Empty_State">
              <span className="Empty_State_Title">{t('portfolio.transactionsEmpty')}</span>
              {portfolio?.source === 'api' && <span className="Empty_State_Text">{t('portfolio.waitingSync')}</span>}
            </div>
          ) : (
            <>
              <div className="Table_Wrap">
                <table className="Table">
                  <thead>
                    <tr>
                      <th>{t('portfolio.date')}</th>
                      <th>{t('portfolio.kindColumn')}</th>
                      <th>{t('portfolio.assetColumn')}</th>
                      <th>{t('portfolio.notes')}</th>
                      <th className="Right">{t('portfolio.amount')}</th>
                    </tr>
                  </thead>
                  <tbody>
                    {page.pageItems.map((tx) => (
                      <tr
                        key={tx.id}
                        className={tx.asset.subClass === 'vehicle' ? 'Clickable' : undefined}
                        onClick={tx.asset.subClass === 'vehicle' ? () => setGoodsId(tx.asset.id) : undefined} tabIndex={tx.asset.subClass === 'vehicle' ? 0 : undefined} onKeyDown={activateOnKey}
                      >
                        <td className="Num">{formatDay(day(tx), locale)}</td>
                        <td>{t(`portfolio.kind_${tx.kind}`)}</td>
                        <Transaction_Asset tx={tx} />
                        <td className="Portfolio_Muted">{tx.notes ?? tx.bankAccount?.name ?? '—'}</td>
                        <Transaction_Amount tx={tx} rated={rated} />
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
              <Global_Pagination
                page={page.page}
                totalPages={page.totalPages}
                onPageChange={page.setPage}
                totalItems={page.total}
                pageSize={page.pageSize}
              />
            </>
          )}
        </div>
      </div>
      {goodsId && <Goods_Popover assetId={goodsId} onClose={() => setGoodsId(null)} />}
    </div>
  );
};

export default Portfolio_Page;

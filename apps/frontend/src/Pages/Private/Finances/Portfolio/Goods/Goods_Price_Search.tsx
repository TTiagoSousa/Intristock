import { useEffect, useState } from 'react';
import { useTranslation } from 'react-i18next';
import { useCurrencyFormat } from '../../../../../Hooks/useCurrencyFormat';
import Global_Input from '../../../../../Components/Inputs/Global_Input/Global_Input';
import Simple_Button from '../../../../../Components/Buttons/Simple_Button/Simple_Button';
import { getErrorMessage } from '../../../../../Hooks/useAsyncRequest';
import {
  CONDITION_STAT,
  GOODS_CONDITIONS,
  searchGoodsLocations,
  searchGoodsPrices,
  toggleListing,
  type Goods_Condition,
  type Report_Listing,
  type Valuation_Report,
} from '../../../../../Hooks/Finances/usePortfolioGoods';
import './Goods.scss';

export interface Goods_Search_Params {
  query: string;
  location: string;
  radiusKm: number;
}

interface Goods_Price_Search_Props {
  params: Goods_Search_Params;
  onParams: (params: Goods_Search_Params) => void;
  report: Valuation_Report | null;
  onReport: (report: Valuation_Report | null) => void;
  condition: Goods_Condition;
  onCondition: (condition: Goods_Condition) => void;
  // Sem chaves com pesquisas, só se mostra o último relatório (sem pesquisar)
  canSearch: boolean;
  // Só para ver (o relatório de uma avaliação gravada): sem tirar/repor nem escolher o estado
  readOnly?: boolean;
}

const RADII = [25, 50, 100, 200, 300, 500];

/**
 * A pesquisa de preços de um bem no Facebook Marketplace (2 pesquisas da SerpApi): o que se
 * procura, a localidade e o raio; depois os números dos anúncios que contam, o estado da mota
 * (que ponto dos preços se usa) e os anúncios à venda e vendidos, cada um com o tirar ou repor.
 */
const Goods_Price_Search = ({
  params,
  onParams,
  report,
  onReport,
  condition,
  onCondition,
  canSearch,
  readOnly = false,
}: Goods_Price_Search_Props) => {
  const { t, i18n } = useTranslation();
  const { formatIn } = useCurrencyFormat();
  const [searching, setSearching] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [tab, setTab] = useState<'forSale' | 'sold'>('sold');
  const [locations, setLocations] = useState<string[]>([]);
  const [locationFocus, setLocationFocus] = useState(false);
  const locale = i18n.language === 'pt' ? 'pt-PT' : 'en-GB';
  const money = (value: number | null) => (value === null ? '—' : formatIn(value, report?.currency ?? 'EUR', 0));

  // As localidades, um pouco depois de se parar de escrever (não gastam pesquisas)
  useEffect(() => {
    const text = params.location.trim();
    if (!locationFocus || text.length < 2) {
      setLocations([]);
      return;
    }
    let cancelled = false;
    const timer = window.setTimeout(() => {
      searchGoodsLocations(text)
        .then((rows) => !cancelled && setLocations(rows.map((row) => row.name)))
        .catch(() => !cancelled && setLocations([]));
    }, 300);
    return () => {
      cancelled = true;
      window.clearTimeout(timer);
    };
  }, [params.location, locationFocus]);

  const search = async () => {
    if (!params.query.trim() || !params.location.trim() || searching) return;
    setSearching(true);
    setError(null);
    try {
      const found = await searchGoodsPrices(params.query.trim(), params.location.trim(), params.radiusKm);
      onReport(found);
      setTab(found.sold.length ? 'sold' : 'forSale');
    } catch (err) {
      setError(getErrorMessage(err));
    } finally {
      setSearching(false);
    }
  };

  const stats = report?.stats.all;
  const listings: Report_Listing[] = report ? report[tab] : [];

  return (
    <div className="Goods_Search">
      {canSearch && (
        <div className="Goods_Search_Form">
          <div className="Form_Field Goods_Search_Query">
            <label htmlFor="goods-search-query">{t('goods.searchQuery')}</label>
            <Global_Input
              id="goods-search-query"
              value={params.query}
              maxLength={80}
              onChange={(e) => onParams({ ...params, query: e.target.value })}
            />
          </div>
          <div className="Form_Field Goods_Search_Location" onFocus={() => setLocationFocus(true)}>
            <label htmlFor="goods-search-location">{t('goods.location')}</label>
            <Global_Input
              id="goods-search-location"
              value={params.location}
              maxLength={120}
              autoComplete="off"
              onBlur={() => window.setTimeout(() => setLocationFocus(false), 150)}
              onChange={(e) => onParams({ ...params, location: e.target.value })}
            />
            {locations.length > 0 && (
              <div className="Goods_Locations">
                {locations.map((name) => (
                  <button
                    key={name}
                    type="button"
                    className="Goods_Location"
                    onMouseDown={(e) => e.preventDefault()}
                    onClick={() => {
                      onParams({ ...params, location: name });
                      setLocations([]);
                      setLocationFocus(false);
                    }}
                  >
                    {name}
                  </button>
                ))}
              </div>
            )}
          </div>
          <div className="Form_Field Goods_Search_Radius">
            <label>{t('goods.radius')}</label>
            <div className="Tabs">
              {RADII.map((radius) => (
                <button
                  key={radius}
                  type="button"
                  className={params.radiusKm === radius ? 'Active' : ''}
                  onClick={() => onParams({ ...params, radiusKm: radius })}
                >
                  {radius} km
                </button>
              ))}
            </div>
          </div>
          <div className="Goods_Search_Action">
            <Simple_Button
              text={searching ? t('goods.searching') : report ? t('goods.searchAgain') : t('goods.search')}
              onClick={() => void search()}
              disabled={searching || !params.query.trim() || !params.location.trim()}
              variant={report ? 'Ghost' : 'Primary'}
              auto
            />
            <span className="Field_Hint">{t('goods.searchCost')}</span>
          </div>
        </div>
      )}
      {error && <span className="Field_Hint Portfolio_Error">{error}</span>}

      {report && stats && (
        <>
          <div className="Goods_Stats">
            <div className="Goods_Stat">
              <span className="Goods_Stat_Label">{t('goods.statAverage')}</span>
              <span className="Goods_Stat_Value Num">{money(stats.average)}</span>
            </div>
            <div className="Goods_Stat">
              <span className="Goods_Stat_Label">{t('goods.statMedian')}</span>
              <span className="Goods_Stat_Value Num">{money(stats.median)}</span>
            </div>
            <div className="Goods_Stat">
              <span className="Goods_Stat_Label">{t('goods.statMin')}</span>
              <span className="Goods_Stat_Value Num">{money(stats.min)}</span>
            </div>
            <div className="Goods_Stat">
              <span className="Goods_Stat_Label">{t('goods.statMax')}</span>
              <span className="Goods_Stat_Value Num">{money(stats.max)}</span>
            </div>
          </div>
          <span className="Field_Hint">
            {t('goods.statsBasis', {
              count: stats.count,
              forSale: report.stats.forSale.count,
              sold: report.stats.sold.count,
              when: new Date(report.fetchedAt).toLocaleDateString(locale),
              location: report.location,
              radius: report.radiusKm,
            })}
          </span>

          <div className="Form_Field">
            <label>{t('goods.condition')}</label>
            <div className="Goods_Conditions">
              {GOODS_CONDITIONS.map((option) => {
                const value = stats[CONDITION_STAT[option]] as number | null;
                return (
                  <button
                    key={option}
                    type="button"
                    className={`Goods_Condition${condition === option ? ' Active' : ''}`}
                    disabled={value === null || readOnly}
                    onClick={() => onCondition(option)}
                  >
                    <span className="Goods_Condition_Name">{t(`goods.condition_${option}`)}</span>
                    <span className="Goods_Condition_Value Num">{money(value)}</span>
                  </button>
                );
              })}
            </div>
            <span className="Field_Hint">{t(`goods.conditionHint_${condition}`)}</span>
          </div>

          <div className="Goods_Listings_Head">
            <div className="Tabs">
              {(['sold', 'forSale'] as const).map((option) => (
                <button key={option} type="button" className={tab === option ? 'Active' : ''} onClick={() => setTab(option)}>
                  {t(`goods.tab_${option}`, { count: report[option].length })}
                </button>
              ))}
            </div>
          </div>
          {listings.length === 0 ? (
            <span className="Field_Hint">{t('goods.noListings')}</span>
          ) : (
            <div className="Goods_Listings">
              {listings.map((row) => (
                <div key={row.id} className={`Goods_Listing${row.excluded ? ' Excluded' : ''}`}>
                  {row.thumbnail ? (
                    <img className="Goods_Listing_Photo" src={row.thumbnail} alt="" loading="lazy" referrerPolicy="no-referrer" />
                  ) : (
                    <span className="Goods_Listing_Photo" aria-hidden="true" />
                  )}
                  <div className="Goods_Listing_Text">
                    {row.link ? (
                      <a className="Goods_Listing_Title" href={row.link} target="_blank" rel="noreferrer">
                        {row.title}
                      </a>
                    ) : (
                      <span className="Goods_Listing_Title">{row.title}</span>
                    )}
                    <span className="Goods_Listing_Meta">
                      {[row.location, row.listedAt ? new Date(row.listedAt).toLocaleDateString(locale) : null]
                        .filter(Boolean)
                        .join(' · ')}
                      {row.excluded && (
                        <span className="Goods_Listing_Reason">
                          {' '}
                          · {t(row.excluded === 'manual' ? 'goods.reason_manual' : `goods.reason_${row.reason ?? 'other'}`)}
                        </span>
                      )}
                    </span>
                  </div>
                  <span className="Goods_Listing_Price Num">{money(row.price)}</span>
                  {!readOnly && (
                  <button
                    type="button"
                    className="Goods_Listing_Toggle"
                    onClick={() => onReport(toggleListing(report, row.id))}
                  >
                    {row.excluded ? t('goods.include') : t('goods.exclude')}
                  </button>
                  )}
                </div>
              ))}
            </div>
          )}
        </>
      )}
    </div>
  );
};

export default Goods_Price_Search;

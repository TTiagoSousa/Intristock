import { useEffect, useState } from 'react';
import { createPortal } from 'react-dom';
import { useTranslation } from 'react-i18next';
import { useCurrencyFormat } from '../../../../../Hooks/useCurrencyFormat';
import Global_Input from '../../../../../Components/Inputs/Global_Input/Global_Input';
import Global_Dropdown from '../../../../../Components/Inputs/Global_Dropdown/Global_Dropdown';
import Simple_Button from '../../../../../Components/Buttons/Simple_Button/Simple_Button';
import { PORTFOLIO_CHANGED_EVENT, usePortfolioTransaction } from '../../../../../Hooks/Finances/usePersonalPortfolio';
import {
  CONDITION_STAT,
  DEFAULT_LOCATION,
  DEFAULT_RADIUS_KM,
  VALUATION_INTERVALS,
  useGoods,
  usePricesAvailable,
  valuationBody,
  type Goods_Condition,
  type Valuation_Report,
} from '../../../../../Hooks/Finances/usePortfolioGoods';
import { formatDateOnly, localToday, parseAmount } from '../../../../../Hooks/Finances/portfolioInput';
import Goods_Price_Search, { type Goods_Search_Params } from './Goods_Price_Search';
import './Goods.scss';

interface Goods_Popover_Props {
  assetId: string;
  onClose: () => void;
}

type Mode = 'view' | 'search' | 'manual' | 'sell';
const NEW = 'new';
const SELF = 'self';
const NONE = 'none';

/**
 * Uma mota: o que vale hoje e o que custou, os dados, a atualização automática, as avaliações
 * ao longo do tempo e o relatório da última pesquisa (à venda, vendidas, média). Daqui
 * atualiza-se o preço (uma pesquisa nova, só quando se carrega), grava-se um valor à mão ou
 * vende-se. Abrir nunca pesquisa.
 */
const Goods_Popover = ({ assetId, onClose }: Goods_Popover_Props) => {
  const { t, i18n } = useTranslation();
  const { formatIn } = useCurrencyFormat();
  const locale = i18n.language === 'pt' ? 'pt-PT' : 'en-GB';
  const { goods, error, setError, saving, update, addValuation, sell } = useGoods(assetId);
  const pricesAvailable = usePricesAvailable();
  const { portfolios: allPortfolios } = usePortfolioTransaction();
  const portfolios = allPortfolios.filter((item) => item.source !== 'api');

  const [mode, setMode] = useState<Mode>('view');
  const [params, setParams] = useState<Goods_Search_Params | null>(null);
  const [report, setReport] = useState<Valuation_Report | null>(null);
  const [condition, setCondition] = useState<Goods_Condition>('average');
  const [manualValue, setManualValue] = useState('');
  const [valueDate, setValueDate] = useState(localToday);
  const [salePrice, setSalePrice] = useState('');
  const [saleDate, setSaleDate] = useState(localToday);
  const [cashTo, setCashTo] = useState(NEW);

  useEffect(() => {
    const handleEscape = (e: KeyboardEvent) => {
      if (e.key === 'Escape') onClose();
    };
    document.addEventListener('keydown', handleEscape);
    return () => document.removeEventListener('keydown', handleEscape);
  }, [onClose]);

  const code = goods?.currency?.shortCode ?? 'EUR';
  const money = (value: number | null) => (value === null ? '—' : formatIn(value, code));
  // Os dias (a compra, as avaliações) são datas sem hora: sem o fuso a puxá-los para o dia antes
  const date = (value: string | null) => formatDateOnly(value, locale);
  // A próxima atualização é um instante (na hora local)
  const instant = (value: string | null) => (value ? new Date(value).toLocaleDateString(locale) : '—');
  const details = goods?.asset.details;
  const searchParams: Goods_Search_Params = params ?? {
    query: details?.searchQuery || `${details?.brand ?? ''} ${details?.model ?? ''}`.trim(),
    location: details?.location || DEFAULT_LOCATION,
    radiusKm: details?.radiusKm || DEFAULT_RADIUS_KM,
  };

  const changed = (ok: boolean) => {
    if (!ok) return;
    window.dispatchEvent(new Event(PORTFOLIO_CHANGED_EVENT));
    setMode('view');
    setReport(null);
    setManualValue('');
    setSalePrice('');
  };

  const startSearch = () => {
    setReport(null);
    setCondition(goods?.report?.condition ?? 'average');
    setError(null);
    setMode('search');
  };

  const saveSearch = async () => {
    if (!report || !details) return;
    // A pesquisa usada fica nos dados da mota (é a que a atualização automática repete)
    if (
      searchParams.query !== details.searchQuery ||
      searchParams.location !== details.location ||
      searchParams.radiusKm !== details.radiusKm
    ) {
      const updated = await update({
        details: { ...details, searchQuery: searchParams.query, location: searchParams.location, radiusKm: searchParams.radiusKm },
      });
      // Sem a pesquisa gravada não se grava o valor (o erro fica à vista)
      if (!updated) return;
    }
    changed(await addValuation(valuationBody(report, condition, null)));
  };

  const searched = report ? ((report.stats.all[CONDITION_STAT[condition]] as number | null) ?? null) : null;
  // Os anúncios vêm na moeda do Marketplace; o servidor passa o valor à da mota ao gravar
  const reportCode = report?.currency ?? code;
  const searchedMoney = searched === null ? '—' : formatIn(searched, reportCode);
  // Escrito à portuguesa ou à inglesa; inválido = nulo (e o gravar fica desligado)
  const manual = manualValue.trim() ? parseAmount(manualValue) : null;
  const sale = salePrice.trim() ? parseAmount(salePrice) : null;
  const gain = goods && goods.entryValue !== null ? goods.value - goods.entryValue : null;

  const others = portfolios.filter((item) => item.id !== goods?.portfolio?.id);
  const cashOptions = [
    { value: NEW, label: t('portfolio.cashNewSell') },
    ...(goods?.portfolio ? [{ value: SELF, label: t('portfolio.cashSelf', { name: goods.portfolio.name }) }] : []),
    ...others.map((item) => ({ value: item.id, label: item.name })),
    { value: NONE, label: t('goods.cashNoneSell') },
  ];

  const footer = (() => {
    if (!goods) return null;
    if (mode === 'search')
      return (
        <>
          <div className="Form_Action">
            <Simple_Button text={t('common.cancel')} onClick={() => setMode('view')} variant="Ghost" />
          </div>
          <div className="Form_Action">
            <Simple_Button
              text={saving ? t('common.saving') : t('goods.saveValuation', { value: searchedMoney })}
              onClick={() => void saveSearch()}
              disabled={saving || searched === null}
            />
          </div>
        </>
      );
    if (mode === 'manual')
      return (
        <>
          <div className="Form_Action">
            <Simple_Button text={t('common.cancel')} onClick={() => setMode('view')} variant="Ghost" />
          </div>
          <div className="Form_Action">
            <Simple_Button
              text={saving ? t('common.saving') : t('common.save')}
              onClick={async () => changed(await addValuation({ manualValue: manual, date: valueDate }))}
              disabled={saving || manual === null || manual < 0 || !valueDate}
            />
          </div>
        </>
      );
    if (mode === 'sell')
      return (
        <>
          <div className="Form_Action">
            <Simple_Button text={t('common.cancel')} onClick={() => setMode('view')} variant="Ghost" />
          </div>
          <div className="Form_Action">
            <Simple_Button
              text={saving ? t('common.saving') : t('goods.sell')}
              onClick={async () =>
                changed(
                  await sell({
                    date: saleDate,
                    price: sale ?? 0,
                    cash: cashTo === NONE ? 'none' : cashTo === NEW ? 'new' : 'portfolio',
                    ...(cashTo !== NEW && cashTo !== SELF && cashTo !== NONE ? { cashPortfolioId: cashTo } : {}),
                  }),
                )
              }
              disabled={saving || sale === null || sale < 0 || !saleDate}
            />
          </div>
        </>
      );
    return (
      <div className="Form_Action">
        <Simple_Button text={t('common.close')} onClick={onClose} variant="Ghost" />
      </div>
    );
  })();

  return createPortal(
    <div className="Popover_Backdrop" onClick={onClose}>
      <div className="Popover_Card Goods_Card" onClick={(e) => e.stopPropagation()}>
        <div className="Popover_Header">
          <div className="Popover_Header_Text">
            <span className="Popover_Title">{goods?.asset.name ?? t('common.loading')}</span>
            <span className="Popover_Subtitle">
              {goods
                ? [goods.portfolio?.name, goods.acquisition ? t(`goods.acquisition_${goods.acquisition}`) : null, date(goods.acquiredAt)]
                    .filter(Boolean)
                    .join(' · ')
                : ''}
            </span>
          </div>
          <button type="button" className="Popover_Close" onClick={onClose} aria-label={t('common.cancel')}>
            ×
          </button>
        </div>

        <div className="Popover_Body Single_Column">
          {!goods && !error && <span className="Field_Hint">{t('common.loading')}</span>}
          {goods && (
            <>
              <div className="Goods_Stats">
                <div className="Goods_Stat">
                  <span className="Goods_Stat_Label">{t(goods.held ? 'goods.valueToday' : 'goods.soldFor')}</span>
                  <span className="Goods_Stat_Value Num">{money(goods.held ? goods.value : (goods.sale?.price ?? null))}</span>
                </div>
                <div className="Goods_Stat">
                  <span className="Goods_Stat_Label">{t(goods.purchasePrice !== null ? 'goods.paid' : 'goods.enteredAt')}</span>
                  <span className="Goods_Stat_Value Num">{money(goods.purchasePrice ?? goods.entryValue)}</span>
                </div>
                <div className="Goods_Stat">
                  <span className="Goods_Stat_Label">{t('goods.difference')}</span>
                  <span
                    className={`Goods_Stat_Value Num ${
                      (goods.held ? gain : (goods.sale?.realized ?? null)) === null
                        ? ''
                        : (goods.held ? gain! : goods.sale!.realized) >= 0
                          ? 'Gain'
                          : 'Loss'
                    }`}
                  >
                    {money(goods.held ? gain : (goods.sale?.realized ?? null))}
                  </span>
                </div>
                <div className="Goods_Stat">
                  <span className="Goods_Stat_Label">{t('goods.year')}</span>
                  <span className="Goods_Stat_Value Num">{details?.year ?? '—'}</span>
                </div>
              </div>
              <span className="Field_Hint">
                {[details?.brand, details?.model, details?.version, details?.plate].filter(Boolean).join(' · ')}
              </span>

              {mode === 'view' && (
                <>
                  {goods.held && (
                    <div className="Goods_Actions">
                      {pricesAvailable && (
                        <Simple_Button text={t('goods.updatePrice')} onClick={startSearch} auto />
                      )}
                      <Simple_Button text={t('goods.manualValue')} onClick={() => setMode('manual')} variant="Ghost" auto />
                      <Simple_Button text={t('goods.sell')} onClick={() => setMode('sell')} variant="Ghost" auto />
                    </div>
                  )}

                  {goods.held && pricesAvailable && (
                    <div className="Form_Field">
                      <label>{t('goods.autoUpdate')}</label>
                      <div className="Tabs">
                        {VALUATION_INTERVALS.map((days) => (
                          <button
                            key={days}
                            type="button"
                            disabled={saving}
                            className={(goods.asset.valuationEveryDays ?? 0) === days ? 'Active' : ''}
                            onClick={() => void update({ valuationEveryDays: days || null })}
                          >
                            {t(`goods.every_${days}`)}
                          </button>
                        ))}
                      </div>
                      <span className="Field_Hint">
                        {goods.asset.valuationNextAt
                          ? t('goods.nextUpdate', { when: instant(goods.asset.valuationNextAt) })
                          : t('goods.autoUpdateOff')}
                      </span>
                    </div>
                  )}

                  <span className="Goods_Section_Title">{t('goods.history')}</span>
                  <div className="Goods_History">
                    {[...goods.history].reverse().map((row) => (
                      <div key={row.id} className="Goods_History_Row">
                        <span className="Num">{date(row.date)}</span>
                        <span className="Goods_History_Source">
                          {t(`goods.source_${row.source}`)}
                          {row.condition && row.source === 'search' ? ` · ${t(`goods.condition_${row.condition}`)}` : ''}
                        </span>
                        <span className="Goods_History_Value Num">{money(row.value)}</span>
                      </div>
                    ))}
                  </div>

                  {goods.report && (
                    <>
                      <span className="Goods_Section_Title">{t('goods.lastReport')}</span>
                      <Goods_Price_Search
                        params={searchParams}
                        onParams={() => undefined}
                        report={goods.report}
                        onReport={() => undefined}
                        condition={goods.report.condition ?? 'average'}
                        onCondition={() => undefined}
                        canSearch={false}
                        readOnly
                      />
                    </>
                  )}
                </>
              )}

              {mode === 'search' && (
                <Goods_Price_Search
                  params={searchParams}
                  onParams={setParams}
                  report={report}
                  onReport={setReport}
                  condition={condition}
                  onCondition={setCondition}
                  canSearch
                />
              )}
              {mode === 'search' && report && report.currency !== code && (
                <span className="Field_Hint">{t('goods.convertedAtSave', { from: report.currency, to: code })}</span>
              )}

              {mode === 'manual' && (
                <div className="Portfolio_Pair">
                  <div className="Form_Field">
                    <label htmlFor="goods-value">{t('goods.currentValue')} *</label>
                    <Global_Input id="goods-value" value={manualValue} onChange={(e) => setManualValue(e.target.value)} />
                  </div>
                  <div className="Form_Field">
                    <label htmlFor="goods-value-date">{t('portfolio.date')} *</label>
                    <Global_Input id="goods-value-date" type="date" value={valueDate} onChange={(e) => setValueDate(e.target.value)} />
                  </div>
                </div>
              )}

              {mode === 'sell' && (
                <>
                  <div className="Portfolio_Pair">
                    <div className="Form_Field">
                      <label htmlFor="goods-sale-price">{t('goods.salePrice')} *</label>
                      <Global_Input id="goods-sale-price" value={salePrice} onChange={(e) => setSalePrice(e.target.value)} />
                    </div>
                    <div className="Form_Field">
                      <label htmlFor="goods-sale-date">{t('portfolio.date')} *</label>
                      <Global_Input id="goods-sale-date" type="date" value={saleDate} onChange={(e) => setSaleDate(e.target.value)} />
                    </div>
                  </div>
                  <div className="Form_Field">
                    <label htmlFor="goods-cash-to">{t('portfolio.cashFromSell')}</label>
                    <Global_Dropdown id="goods-cash-to" value={cashTo} onChange={(next) => setCashTo(String(next))} options={cashOptions} />
                  </div>
                </>
              )}
            </>
          )}
          {error && <span className="Field_Hint Portfolio_Error">{error}</span>}
        </div>
        <div className="Popover_Footer">{footer}</div>
      </div>
    </div>,
    document.body,
  );
};

export default Goods_Popover;

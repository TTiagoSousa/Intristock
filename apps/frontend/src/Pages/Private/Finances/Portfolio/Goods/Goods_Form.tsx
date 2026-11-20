import { useState } from 'react';
import { useTranslation } from 'react-i18next';
import { useCurrency } from '../../../../../Contexts/Currency_Context';
import { useCurrencyFormat } from '../../../../../Hooks/useCurrencyFormat';
import Global_Input from '../../../../../Components/Inputs/Global_Input/Global_Input';
import Global_Dropdown from '../../../../../Components/Inputs/Global_Dropdown/Global_Dropdown';
import Simple_Button from '../../../../../Components/Buttons/Simple_Button/Simple_Button';
import type { Personal_Portfolio } from '../../../../../Hooks/Finances/usePersonalPortfolio';
import {
  ACQUISITIONS,
  CONDITION_STAT,
  DEFAULT_LOCATION,
  DEFAULT_RADIUS_KM,
  VALUATION_INTERVALS,
  usePricesAvailable,
  valuationBody,
  type Create_Goods_Body,
  type Goods_Acquisition,
  type Goods_Condition,
  type Valuation_Report,
} from '../../../../../Hooks/Finances/usePortfolioGoods';
import { localToday, parseAmount } from '../../../../../Hooks/Finances/portfolioInput';
import Goods_Price_Search, { type Goods_Search_Params } from './Goods_Price_Search';
import './Goods.scss';

interface Goods_Form_Props {
  portfolio: Personal_Portfolio;
  // Os outros portefólios manuais (de onde pode sair o dinheiro)
  portfolios: Personal_Portfolio[];
  header: React.ReactNode;
  errorLine: React.ReactNode;
  saving: boolean;
  onBack: () => void;
  onSubmit: (body: Create_Goods_Body) => void;
}

const NEW = 'new';
const SELF = 'self';
const NONE = 'none';
type Value_Mode = 'none' | 'manual' | 'search';

/**
 * Registar uma mota: os dados (marca, modelo, versão, ano, matrícula), como se obteve
 * (compra, oferta, herança), o preço de compra (opcional) e de onde veio o dinheiro, e o
 * valor de agora — nenhum, à mão, ou pela pesquisa de preços online com o estado — e se se
 * atualiza sozinho.
 */
const Goods_Form = ({ portfolio, portfolios, header, errorLine, saving, onBack, onSubmit }: Goods_Form_Props) => {
  const { t } = useTranslation();
  const { currencies, selectedCurrency } = useCurrency();
  const { formatIn } = useCurrencyFormat();
  const pricesAvailable = usePricesAvailable();

  const [brand, setBrand] = useState('');
  const [model, setModel] = useState('');
  const [version, setVersion] = useState('');
  const [year, setYear] = useState('');
  const [plate, setPlate] = useState('');
  const [acquisition, setAcquisition] = useState<Goods_Acquisition>('purchase');
  const [date, setDate] = useState(localToday);
  const [price, setPrice] = useState('');
  const [chosenCurrencyId, setCurrencyId] = useState('');
  const currencyId =
    chosenCurrencyId || (currencies.find((currency) => currency.shortCode === selectedCurrency) ?? currencies[0])?.id || '';
  const [cashFrom, setCashFrom] = useState(NEW);
  const [valueMode, setValueMode] = useState<Value_Mode>('none');
  const [manualValue, setManualValue] = useState('');
  // A pesquisa: por omissão a marca e o modelo (sem a versão, apanha mais anúncios)
  const [searchParams, setSearchParams] = useState<Goods_Search_Params & { touched: boolean }>({
    query: '',
    location: DEFAULT_LOCATION,
    radiusKm: DEFAULT_RADIUS_KM,
    touched: false,
  });
  const params = { ...searchParams, query: searchParams.touched ? searchParams.query : `${brand} ${model}`.trim() };
  const [report, setReport] = useState<Valuation_Report | null>(null);
  const [condition, setCondition] = useState<Goods_Condition>('average');
  const [every, setEvery] = useState(0);
  const [notes, setNotes] = useState('');

  const code = currencies.find((item) => item.id === currencyId)?.shortCode;
  const purchase = acquisition === 'purchase';
  // Escritos à portuguesa ou à inglesa ("12.500", "1.200,50"); inválido = nulo
  const priceValue = price.trim() ? parseAmount(price) : null;
  const priceInvalid = Boolean(price.trim()) && priceValue === null;
  const searchedValue = report ? ((report.stats.all[CONDITION_STAT[condition]] as number | null) ?? null) : null;
  const manual = manualValue.trim() ? parseAmount(manualValue) : null;
  const currentValue = valueMode === 'manual' ? manual : valueMode === 'search' ? searchedValue : null;
  // O valor da pesquisa está na moeda dos anúncios; o servidor passa-o à da mota ao gravar
  const currentCode = valueMode === 'search' && report ? report.currency : code;
  const converted = Boolean(valueMode === 'search' && report && code && report.currency !== code);
  const valid =
    Boolean(brand.trim()) &&
    Boolean(model.trim()) &&
    Boolean(date) &&
    Boolean(currencyId) &&
    !(purchase && priceInvalid) &&
    (priceValue === null || priceValue >= 0) &&
    (valueMode !== 'manual' || (manual !== null && manual >= 0)) &&
    (valueMode !== 'search' || searchedValue !== null);

  const others = portfolios.filter((item) => item.id !== portfolio.id);
  const cashOptions = [
    { value: NEW, label: t('portfolio.cashNewBuy') },
    { value: SELF, label: t('portfolio.cashSelf', { name: portfolio.name }) },
    ...others.map((item) => ({ value: item.id, label: item.name })),
    { value: NONE, label: t('goods.cashNone') },
  ];
  const withCash = purchase && priceValue !== null && priceValue > 0;

  const submit = (event: React.FormEvent) => {
    event.preventDefault();
    if (!valid) return;
    const cash = !withCash || cashFrom === NONE ? 'none' : cashFrom === NEW ? 'new' : 'portfolio';
    onSubmit({
      portfolioId: portfolio.id,
      details: {
        vehicleType: 'motorcycle',
        brand: brand.trim(),
        model: model.trim(),
        ...(version.trim() ? { version: version.trim() } : {}),
        ...(year.trim() ? { year: Number(year) } : {}),
        ...(plate.trim() ? { plate: plate.trim().toUpperCase() } : {}),
        searchQuery: params.query.trim() || undefined,
        location: params.location.trim() || undefined,
        radiusKm: params.radiusKm,
      },
      date,
      acquisition,
      price: purchase ? priceValue : null,
      currencyId,
      cash,
      ...(cash === 'portfolio' && cashFrom !== SELF ? { cashPortfolioId: cashFrom } : {}),
      ...(valueMode === 'manual' && manual !== null ? { valuation: { manualValue: manual } } : {}),
      ...(valueMode === 'search' && report ? { valuation: valuationBody(report, condition, null) } : {}),
      valuationEveryDays: every || null,
      notes: notes.trim() || undefined,
    });
  };

  return (
    <form className="Popover_Card Goods_Card" onClick={(e) => e.stopPropagation()} onSubmit={submit}>
      {header}
      <div className="Popover_Body Single_Column">
        <span className="Goods_Section_Title">{t('goods.sectionBike')}</span>
        <div className="Portfolio_Pair">
          <div className="Form_Field">
            <label htmlFor="goods-brand">{t('goods.brand')} *</label>
            <Global_Input id="goods-brand" value={brand} maxLength={60} placeholder="Casal" onChange={(e) => setBrand(e.target.value)} />
          </div>
          <div className="Form_Field">
            <label htmlFor="goods-model">{t('goods.model')} *</label>
            <Global_Input id="goods-model" value={model} maxLength={80} placeholder="Boss" onChange={(e) => setModel(e.target.value)} />
          </div>
        </div>
        <div className="Goods_Triple">
          <div className="Form_Field">
            <label htmlFor="goods-version">{t('goods.version')}</label>
            <Global_Input id="goods-version" value={version} maxLength={60} placeholder="2V" onChange={(e) => setVersion(e.target.value)} />
          </div>
          <div className="Form_Field">
            <label htmlFor="goods-year">{t('goods.year')}</label>
            <Global_Input id="goods-year" value={year} maxLength={4} onChange={(e) => setYear(e.target.value.replace(/\D/g, ''))} />
          </div>
          <div className="Form_Field">
            <label htmlFor="goods-plate">{t('goods.plate')}</label>
            <Global_Input id="goods-plate" value={plate} maxLength={20} onChange={(e) => setPlate(e.target.value)} />
          </div>
        </div>

        <span className="Goods_Section_Title">{t('goods.sectionEntry')}</span>
        <div className="Form_Field">
          <label>{t('goods.acquisition')}</label>
          <div className="Tabs">
            {ACQUISITIONS.map((option) => (
              <button key={option} type="button" className={acquisition === option ? 'Active' : ''} onClick={() => setAcquisition(option)}>
                {t(`goods.acquisition_${option}`)}
              </button>
            ))}
          </div>
        </div>
        <div className="Portfolio_Pair">
          <div className="Form_Field">
            <label htmlFor="goods-date">{t(purchase ? 'goods.datePurchase' : 'goods.dateEntry')} *</label>
            <Global_Input id="goods-date" type="date" value={date} onChange={(e) => setDate(e.target.value)} />
          </div>
          <div className="Form_Field">
            <label htmlFor="goods-currency">{t('portfolio.currency')} *</label>
            <Global_Dropdown
              id="goods-currency"
              value={currencyId}
              onChange={(next) => setCurrencyId(String(next))}
              options={currencies.map((currency) => ({ value: currency.id, label: `${currency.shortCode} · ${currency.name}` }))}
            />
          </div>
        </div>
        {purchase && (
          <div className="Portfolio_Pair">
            <div className="Form_Field">
              <label htmlFor="goods-price">{t('goods.purchasePrice')}</label>
              <Global_Input id="goods-price" value={price} onChange={(e) => setPrice(e.target.value)} />
              <span className="Field_Hint">{t('goods.purchasePriceHint')}</span>
            </div>
            {withCash && (
              <div className="Form_Field">
                <label htmlFor="goods-cash-from">{t('portfolio.cashFromBuy')}</label>
                <Global_Dropdown id="goods-cash-from" value={cashFrom} onChange={(next) => setCashFrom(String(next))} options={cashOptions} />
              </div>
            )}
          </div>
        )}

        <span className="Goods_Section_Title">{t('goods.sectionValue')}</span>
        <div className="Form_Field">
          <div className="Tabs">
            {(['none', 'manual', ...(pricesAvailable ? ['search'] : [])] as Value_Mode[]).map((option) => (
              <button key={option} type="button" className={valueMode === option ? 'Active' : ''} onClick={() => setValueMode(option)}>
                {t(`goods.valueMode_${option}`)}
              </button>
            ))}
          </div>
          <span className="Field_Hint">
            {pricesAvailable === false && valueMode !== 'manual' ? t('goods.searchUnavailable') : t(`goods.valueModeHint_${valueMode}`)}
          </span>
        </div>
        {valueMode === 'manual' && (
          <div className="Form_Field">
            <label htmlFor="goods-manual-value">{t('goods.currentValue')} *</label>
            <Global_Input id="goods-manual-value" value={manualValue} onChange={(e) => setManualValue(e.target.value)} />
          </div>
        )}
        {valueMode === 'search' && (
          <Goods_Price_Search
            params={params}
            onParams={(next) => setSearchParams({ ...next, touched: true })}
            report={report}
            onReport={setReport}
            condition={condition}
            onCondition={setCondition}
            canSearch
          />
        )}

        {pricesAvailable && (
          <div className="Form_Field">
            <label>{t('goods.autoUpdate')}</label>
            <div className="Tabs">
              {VALUATION_INTERVALS.map((days) => (
                <button key={days} type="button" className={every === days ? 'Active' : ''} onClick={() => setEvery(days)}>
                  {t(`goods.every_${days}`)}
                </button>
              ))}
            </div>
            <span className="Field_Hint">{t(every ? 'goods.autoUpdateHint' : 'goods.autoUpdateOff')}</span>
          </div>
        )}

        <div className="Form_Field">
          <label htmlFor="goods-notes">{t('portfolio.notes')}</label>
          <Global_Input id="goods-notes" value={notes} maxLength={500} onChange={(e) => setNotes(e.target.value)} />
        </div>

        {code && (currentValue !== null || priceValue !== null) && (
          <span className="Field_Hint Num">
            {currentValue !== null
              ? t('goods.summaryValue', { value: formatIn(currentValue, currentCode) })
              : t('goods.summaryEntry', { value: formatIn(priceValue ?? 0, code) })}
          </span>
        )}
        {converted && <span className="Field_Hint">{t('goods.convertedAtSave', { from: report?.currency, to: code })}</span>}
        {errorLine}
      </div>
      <div className="Popover_Footer">
        <div className="Form_Action">
          <Simple_Button text={t('portfolio.back')} onClick={onBack} variant="Ghost" />
        </div>
        <div className="Form_Action">
          <Simple_Button type="submit" text={saving ? t('common.saving') : t('common.save')} disabled={saving || !valid} />
        </div>
      </div>
    </form>
  );
};

export default Goods_Form;

import { useEffect, useRef, useState } from 'react';
import { useTranslation } from 'react-i18next';
import { useCurrency } from '../../../../Contexts/Currency_Context';
import { useCurrencyFormat } from '../../../../Hooks/useCurrencyFormat';
import Global_Input from '../../../../Components/Inputs/Global_Input/Global_Input';
import Global_Dropdown from '../../../../Components/Inputs/Global_Dropdown/Global_Dropdown';
import Simple_Button from '../../../../Components/Buttons/Simple_Button/Simple_Button';
import {
  CRYPTO_SOURCES,
  findMarketPrice,
  searchMarkets,
  type Crypto_Source,
  type Market_Result,
  type Personal_Portfolio,
  type Position_Transaction_Body,
} from '../../../../Hooks/Finances/usePersonalPortfolio';

interface Portfolio_Position_Form_Props {
  // securities: ações e ETF do Yahoo · crypto: um par da Binance ou da Coinbase
  assetType: 'securities' | 'crypto';
  portfolio: Personal_Portfolio;
  // Os outros portefólios manuais (de onde pode sair o dinheiro)
  portfolios: Personal_Portfolio[];
  header: React.ReactNode;
  errorLine: React.ReactNode;
  saving: boolean;
  onBack: () => void;
  onSubmit: (body: Position_Transaction_Body) => void;
}

const number = (value: string) => Number(value.replace(',', '.'));
const today = () => new Date().toISOString().slice(0, 10);
// As stablecoins do dólar pagam-se em dólares; os pence ingleses em libras
const STABLE_USD = ['USDT', 'USDC', 'FDUSD', 'BUSD', 'DAI', 'TUSD', 'USDP'];
const currencyOfQuote = (quote: string | null) =>
  !quote ? null : quote === 'GBX' ? 'GBP' : STABLE_USD.includes(quote) ? 'USD' : quote;
// O próprio portefólio, ou dinheiro novo (que entra ou sai da carteira)
const SELF = 'self';
const NEW = 'new';

/**
 * Uma compra ou venda à mão: o mercado (pesquisa no Yahoo, ou um par da corretora de
 * cripto escolhida), o tipo, a data, a quantidade, o preço (o fecho desse dia proposto,
 * enquanto não se escreve outro), a comissão, a moeda e de onde vem o dinheiro.
 */
const Portfolio_Position_Form = ({
  assetType,
  portfolio,
  portfolios,
  header,
  errorLine,
  saving,
  onBack,
  onSubmit,
}: Portfolio_Position_Form_Props) => {
  const { t } = useTranslation();
  const { currencies } = useCurrency();
  const { formatIn } = useCurrencyFormat();
  const crypto = assetType === 'crypto';

  const [source, setSource] = useState<Crypto_Source>('binance');
  const [query, setQuery] = useState('');
  const [results, setResults] = useState<Market_Result[] | null>(null);
  const [searching, setSearching] = useState(false);
  const [market, setMarket] = useState<Market_Result | null>(null);

  const [kind, setKind] = useState<'buy' | 'sell'>('buy');
  const [date, setDate] = useState(today());
  const [quantity, setQuantity] = useState('');
  const [price, setPrice] = useState('');
  // O preço proposto (o fecho do dia); escrever um à mão para de o propor
  const [suggested, setSuggested] = useState<{ price: number; date: string } | null>(null);
  const priceTyped = useRef(false);
  const [fee, setFee] = useState('');
  const [currencyId, setCurrencyId] = useState('');
  const [cashFrom, setCashFrom] = useState(NEW);
  const [notes, setNotes] = useState('');

  // A pesquisa, um pouco depois de se parar de escrever
  useEffect(() => {
    const text = query.trim();
    if (market || text.length < (crypto ? 2 : 1)) {
      setResults(null);
      return;
    }
    let cancelled = false;
    const timer = window.setTimeout(() => {
      setSearching(true);
      searchMarkets(crypto ? 'crypto' : 'stock', text, crypto ? source : undefined)
        .then((rows) => !cancelled && setResults(rows))
        .catch(() => !cancelled && setResults([]))
        .finally(() => !cancelled && setSearching(false));
    }, 300);
    return () => {
      cancelled = true;
      window.clearTimeout(timer);
    };
  }, [query, crypto, source, market]);

  // O fecho do dia escolhido, para propor o preço e a moeda
  useEffect(() => {
    if (!market || !date) return;
    let cancelled = false;
    findMarketPrice(market, date)
      .then((found) => {
        if (cancelled || !found) return;
        const code = currencyOfQuote(found.quote ?? market.quote);
        // Os pence ingleses passam a libras
        const value = found.quote === 'GBX' ? found.close / 100 : found.close;
        setSuggested({ price: value, date: found.date });
        if (!priceTyped.current) setPrice(String(Number(value.toPrecision(8))));
        const currency = currencies.find((item) => item.shortCode === code);
        if (currency) setCurrencyId((current) => current || currency.id);
      })
      .catch(() => !cancelled && setSuggested(null));
    return () => {
      cancelled = true;
    };
  }, [market, date, currencies]);

  const chooseMarket = (chosen: Market_Result) => {
    setMarket(chosen);
    setResults(null);
    setCurrencyId('');
    priceTyped.current = false;
    setSuggested(null);
  };
  const changeMarket = () => {
    setMarket(null);
    setPrice('');
    setSuggested(null);
  };

  const qty = number(quantity);
  const unit = number(price);
  const fees = fee ? number(fee) : 0;
  const total = qty > 0 && unit > 0 ? (kind === 'buy' ? qty * unit + fees : qty * unit - fees) : 0;
  const code = currencies.find((item) => item.id === currencyId)?.shortCode;
  const valid = Boolean(market) && qty > 0 && unit > 0 && fees >= 0 && total > 0 && Boolean(currencyId) && Boolean(date);

  const others = portfolios.filter((item) => item.id !== portfolio.id);
  const cashOptions = [
    { value: NEW, label: t(kind === 'buy' ? 'portfolio.cashNewBuy' : 'portfolio.cashNewSell') },
    { value: SELF, label: t('portfolio.cashSelf', { name: portfolio.name }) },
    ...others.map((item) => ({ value: item.id, label: item.name })),
  ];

  const submit = (event: React.FormEvent) => {
    event.preventDefault();
    if (!valid || !market) return;
    onSubmit({
      kind,
      date,
      ...(market.yahooSymbol ? { yahooSymbol: market.yahooSymbol } : { instrumentId: market.instrumentId! }),
      quantity: qty,
      price: unit,
      fee: fees,
      currencyId,
      cash: cashFrom === NEW ? 'new' : 'portfolio',
      ...(cashFrom !== NEW && cashFrom !== SELF ? { cashPortfolioId: cashFrom } : {}),
      notes: notes.trim() || null,
    });
  };

  return (
    <form className="Popover_Card Narrow" onClick={(e) => e.stopPropagation()} onSubmit={submit}>
      {header}
      <div className="Popover_Body Single_Column">
        {crypto && (
          <div className="Form_Field">
            <label>{t('portfolio.exchange')}</label>
            <div className="Tabs">
              {CRYPTO_SOURCES.map((option) => (
                <button
                  key={option}
                  type="button"
                  className={source === option ? 'Active' : ''}
                  onClick={() => {
                    setSource(option);
                    changeMarket();
                  }}
                >
                  {t(`portfolio.exchange_${option}`)}
                </button>
              ))}
            </div>
          </div>
        )}

        <div className="Form_Field">
          <label htmlFor="portfolio-market">{t(crypto ? 'portfolio.marketCrypto' : 'portfolio.marketStock')} *</label>
          {market ? (
            <div className="Portfolio_Market_Chosen">
              <span className="Portfolio_Choice_Name">
                {market.name}
                <span className="Portfolio_Muted Num"> · {market.symbol}</span>
              </span>
              <span className="Portfolio_Choice_Meta">{market.venue}</span>
              <button type="button" className="Portfolio_Link" onClick={changeMarket}>
                {t('portfolio.marketChange')}
              </button>
            </div>
          ) : (
            <>
              <Global_Input
                id="portfolio-market"
                value={query}
                placeholder={t(crypto ? 'portfolio.marketCryptoPlaceholder' : 'portfolio.marketStockPlaceholder')}
                onChange={(e) => setQuery(e.target.value)}
              />
              {searching && <span className="Field_Hint">{t('portfolio.marketSearching')}</span>}
              {results && !searching && results.length === 0 && (
                <span className="Field_Hint">{t('portfolio.marketNone')}</span>
              )}
              {results && results.length > 0 && (
                <div className="Portfolio_Market_Results">
                  {results.slice(0, 8).map((row) => (
                    <button
                      key={row.instrumentId ?? row.yahooSymbol}
                      type="button"
                      className="Portfolio_Choice Portfolio_Market_Result"
                      onClick={() => chooseMarket(row)}
                    >
                      <span className="Portfolio_Choice_Name">
                        {row.name}
                        <span className="Portfolio_Muted Num"> · {row.symbol}</span>
                      </span>
                      <span className="Portfolio_Choice_Meta">
                        {[row.venue, row.etf ? 'ETF' : null].filter(Boolean).join(' · ')}
                      </span>
                    </button>
                  ))}
                </div>
              )}
            </>
          )}
        </div>

        <div className="Form_Field">
          <div className="Tabs">
            {(['buy', 'sell'] as const).map((option) => (
              <button
                key={option}
                type="button"
                className={kind === option ? 'Active' : ''}
                onClick={() => setKind(option)}
              >
                {t(`portfolio.kind_${option}`)}
              </button>
            ))}
          </div>
        </div>

        <div className="Portfolio_Pair">
          <div className="Form_Field">
            <label htmlFor="portfolio-position-date">{t('portfolio.date')} *</label>
            <Global_Input id="portfolio-position-date" type="date" value={date} onChange={(e) => setDate(e.target.value)} />
          </div>
          <div className="Form_Field">
            <label htmlFor="portfolio-quantity">{t('portfolio.quantity')} *</label>
            <Global_Input id="portfolio-quantity" value={quantity} onChange={(e) => setQuantity(e.target.value)} />
          </div>
        </div>

        <div className="Portfolio_Pair">
          <div className="Form_Field">
            <label htmlFor="portfolio-price">{t('portfolio.unitPrice')} *</label>
            <Global_Input
              id="portfolio-price"
              value={price}
              onChange={(e) => {
                priceTyped.current = true;
                setPrice(e.target.value);
              }}
            />
            {suggested && code && (
              <span className="Field_Hint">
                {t('portfolio.priceSuggested', { price: formatIn(suggested.price, code), date: suggested.date })}
              </span>
            )}
          </div>
          <div className="Form_Field">
            <label htmlFor="portfolio-position-currency">{t('portfolio.currency')} *</label>
            <Global_Dropdown
              id="portfolio-position-currency"
              value={currencyId}
              onChange={(next) => setCurrencyId(String(next))}
              options={currencies.map((currency) => ({ value: currency.id, label: `${currency.shortCode} · ${currency.name}` }))}
            />
          </div>
        </div>

        <div className="Form_Field">
          <label htmlFor="portfolio-fee">{t('portfolio.fee')}</label>
          <Global_Input id="portfolio-fee" value={fee} onChange={(e) => setFee(e.target.value)} />
        </div>

        <div className="Form_Field">
          <label htmlFor="portfolio-cash-from">{t(kind === 'buy' ? 'portfolio.cashFromBuy' : 'portfolio.cashFromSell')}</label>
          <Global_Dropdown id="portfolio-cash-from" value={cashFrom} onChange={(next) => setCashFrom(String(next))} options={cashOptions} />
          <span className="Field_Hint">
            {t(cashFrom === NEW ? (kind === 'buy' ? 'portfolio.cashNewBuyHint' : 'portfolio.cashNewSellHint') : 'portfolio.cashPortfolioHint')}
          </span>
        </div>

        <div className="Form_Field">
          <label htmlFor="portfolio-position-notes">{t('portfolio.notes')}</label>
          <Global_Input id="portfolio-position-notes" value={notes} maxLength={500} onChange={(e) => setNotes(e.target.value)} />
        </div>

        {total > 0 && code && (
          <span className="Field_Hint Num">
            {t(kind === 'buy' ? 'portfolio.totalBuy' : 'portfolio.totalSell', { total: formatIn(total, code) })}
          </span>
        )}
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

export default Portfolio_Position_Form;

import { useEffect, useState } from 'react';
import { createPortal } from 'react-dom';
import { useTranslation } from 'react-i18next';
import { useCurrency } from '../../../../Contexts/Currency_Context';
import Global_Input from '../../../../Components/Inputs/Global_Input/Global_Input';
import Global_Dropdown from '../../../../Components/Inputs/Global_Dropdown/Global_Dropdown';
import Simple_Button from '../../../../Components/Buttons/Simple_Button/Simple_Button';
import {
  PORTFOLIO_CHANGED_EVENT,
  AVAILABLE_ASSET_TYPES,
  CASH_TRANSACTION_KINDS,
  PORTFOLIO_ASSET_TYPES,
  usePortfolioTransaction,
  type Cash_Transaction_Kind,
  type Personal_Portfolio,
  type Portfolio_Asset_Type,
  type Position_Transaction_Body,
} from '../../../../Hooks/Finances/usePersonalPortfolio';
import Portfolio_Position_Form from './Portfolio_Position_Form';
import Goods_Form from './Goods/Goods_Form';
import { createGoods, type Create_Goods_Body } from '../../../../Hooks/Finances/usePortfolioGoods';
import { getErrorMessage } from '../../../../Hooks/useAsyncRequest';
import { localToday, parseAmount } from '../../../../Hooks/Finances/portfolioInput';
import './Portfolio.scss';

interface Portfolio_Transaction_Popover_Props {
  onClose: () => void;
}

type Step = 'portfolio' | 'asset' | 'form';

const NONE = '';

/**
 * Adicionar uma transação, em três passos: o portefólio (um dos que há, ou um
 * novo só com o nome), o tipo de ativo e o formulário dele: o dinheiro passivo,
 * as compras e vendas de títulos (Yahoo) e de cripto (Binance, Coinbase) e as motas
 * (`Goods_Form`, com a pesquisa de preços). Os outros tipos aparecem como «Em breve».
 */
const Portfolio_Transaction_Popover = ({ onClose }: Portfolio_Transaction_Popover_Props) => {
  const { t } = useTranslation();
  const { currencies, selectedCurrency } = useCurrency();
  const {
    portfolios: allPortfolios,
    bankAccounts,
    loading,
    saving,
    error,
    setError,
    createPortfolio,
    createCashTransaction,
    createPositionTransaction,
  } = usePortfolioTransaction();
  // Os de uma corretora são só de leitura: mantém-nos a ligação
  const portfolios = allPortfolios.filter((item) => item.source !== 'api');

  const [step, setStep] = useState<Step>('portfolio');
  const [portfolio, setPortfolio] = useState<Personal_Portfolio | null>(null);
  const [assetType, setAssetType] = useState<Portfolio_Asset_Type | null>(null);
  const [newName, setNewName] = useState('');

  const [kind, setKind] = useState<Cash_Transaction_Kind>('deposit');
  const [amount, setAmount] = useState('');
  // Sem escolha, a moeda é a do topo
  const [chosenCurrencyId, setCurrencyId] = useState('');
  const currencyId =
    chosenCurrencyId || (currencies.find((currency) => currency.shortCode === selectedCurrency) ?? currencies[0])?.id || '';
  const [date, setDate] = useState(localToday);
  const [bankAccountId, setBankAccountId] = useState(NONE);
  const [notes, setNotes] = useState('');
  const [goodsSaving, setGoodsSaving] = useState(false);

  useEffect(() => {
    const handleEscape = (e: KeyboardEvent) => {
      if (e.key === 'Escape') onClose();
    };
    document.addEventListener('keydown', handleEscape);
    return () => document.removeEventListener('keydown', handleEscape);
  }, [onClose]);

  const goTo = (next: Step) => {
    setError(null);
    setStep(next);
  };

  const choosePortfolio = (chosen: Personal_Portfolio) => {
    setPortfolio(chosen);
    goTo('asset');
  };

  const submitNewPortfolio = async (event: React.FormEvent) => {
    event.preventDefault();
    if (!newName.trim()) return;
    const created = await createPortfolio(newName.trim());
    if (created) {
      setNewName('');
      choosePortfolio(created);
    }
  };

  const chooseAsset = (type: Portfolio_Asset_Type) => {
    setAssetType(type);
    goTo('form');
  };

  // Escrito à portuguesa ou à inglesa ("1.200,50", "1200.5"); inválido = nulo
  const value = parseAmount(amount);
  const accounts = bankAccounts.filter(
    (account) => (account.status === 'active' || account.id === bankAccountId) && account.currencyId === currencyId,
  );
  const valid = Boolean(portfolio) && value !== null && value > 0 && Boolean(currencyId) && Boolean(date);

  const submitCash = async (event: React.FormEvent) => {
    event.preventDefault();
    if (!valid || !portfolio || value === null || saving) return;
    const saved = await createCashTransaction(portfolio.id, {
      kind,
      date,
      amount: value,
      currencyId,
      bankAccountId: bankAccountId || null,
      notes: notes.trim() || null,
    });
    if (saved) {
      // O resumo, se estiver aberto, volta a pedir os números
      window.dispatchEvent(new Event(PORTFOLIO_CHANGED_EVENT));
      onClose();
    }
  };

  const submitPosition = async (body: Position_Transaction_Body) => {
    if (!portfolio) return;
    if (await createPositionTransaction(portfolio.id, body)) {
      window.dispatchEvent(new Event(PORTFOLIO_CHANGED_EVENT));
      onClose();
    }
  };

  const submitGoods = async (body: Create_Goods_Body) => {
    setGoodsSaving(true);
    setError(null);
    try {
      await createGoods(body);
      window.dispatchEvent(new Event(PORTFOLIO_CHANGED_EVENT));
      onClose();
    } catch (err) {
      setError(getErrorMessage(err));
    } finally {
      setGoodsSaving(false);
    }
  };

  const subtitle =
    step === 'portfolio'
      ? t('portfolio.chooseSub')
      : [portfolio?.name, assetType && step === 'form' ? t(`portfolio.asset_${assetType}`) : null]
          .filter(Boolean)
          .join(' · ');

  const header = (
    <div className="Popover_Header">
      <div className="Popover_Header_Text">
        <span className="Popover_Title">
          {step === 'portfolio' ? t('portfolio.chooseTitle') : step === 'asset' ? t('portfolio.assetTitle') : t('portfolio.addTitle')}
        </span>
        <span className="Popover_Subtitle">{subtitle}</span>
      </div>
      <button type="button" className="Popover_Close" onClick={onClose} aria-label={t('common.cancel')}>
        ×
      </button>
    </div>
  );

  const errorLine = error && <span className="Field_Hint Portfolio_Error">{error}</span>;

  let content;
  if (step === 'portfolio') {
    content = (
      <div className="Popover_Card Narrow" onClick={(e) => e.stopPropagation()}>
        {header}
        <div className="Popover_Body Single_Column">
          {!loading && portfolios.length === 0 && <span className="Field_Hint">{t('portfolio.noPortfolios')}</span>}
          {portfolios.length > 0 && (
            <div className="Portfolio_Choices">
              {portfolios.map((item) => (
                <button key={item.id} type="button" className="Portfolio_Choice" onClick={() => choosePortfolio(item)}>
                  <span className="Portfolio_Choice_Name">{item.name}</span>
                  <span className="Portfolio_Choice_Meta Num">
                    {t('portfolio.transactionCount', { count: item.transactionCount })}
                  </span>
                </button>
              ))}
            </div>
          )}
          <form className="Portfolio_New" onSubmit={submitNewPortfolio}>
            <label htmlFor="portfolio-new-name">{t('portfolio.newPortfolio')}</label>
            <div className="Portfolio_New_Row">
              <Global_Input
                id="portfolio-new-name"
                value={newName}
                maxLength={80}
                placeholder={t('portfolio.newPortfolioPlaceholder')}
                onChange={(e) => setNewName(e.target.value)}
              />
              <Simple_Button type="submit" text={t('portfolio.create')} disabled={saving || !newName.trim()} auto />
            </div>
          </form>
          {errorLine}
        </div>
      </div>
    );
  } else if (step === 'asset') {
    content = (
      <div className="Popover_Card Narrow" onClick={(e) => e.stopPropagation()}>
        {header}
        <div className="Popover_Body Single_Column">
          <div className="Portfolio_Assets">
            {PORTFOLIO_ASSET_TYPES.map((type) => {
              const available = AVAILABLE_ASSET_TYPES.includes(type);
              return (
                <button
                  key={type}
                  type="button"
                  className="Portfolio_Choice Portfolio_Asset"
                  disabled={!available}
                  onClick={() => chooseAsset(type)}
                >
                  <span className="Portfolio_Choice_Name">{t(`portfolio.asset_${type}`)}</span>
                  <span className="Portfolio_Choice_Meta">
                    {available ? t(`portfolio.assetHint_${type}`) : t('portfolio.soon')}
                  </span>
                </button>
              );
            })}
          </div>
        </div>
        <div className="Popover_Footer">
          <div className="Form_Action">
            <Simple_Button text={t('portfolio.back')} onClick={() => goTo('portfolio')} variant="Ghost" />
          </div>
        </div>
      </div>
    );
  } else if (portfolio && assetType === 'motorcycle') {
    content = (
      <Goods_Form
        portfolio={portfolio}
        portfolios={portfolios}
        header={header}
        errorLine={errorLine}
        saving={goodsSaving}
        onBack={() => goTo('asset')}
        onSubmit={(body) => void submitGoods(body)}
      />
    );
  } else if (portfolio && (assetType === 'securities' || assetType === 'crypto')) {
    content = (
      <Portfolio_Position_Form
        key={assetType}
        assetType={assetType}
        portfolio={portfolio}
        portfolios={portfolios}
        header={header}
        errorLine={errorLine}
        saving={saving}
        onBack={() => goTo('asset')}
        onSubmit={submitPosition}
      />
    );
  } else {
    content = (
      <form className="Popover_Card Narrow" onClick={(e) => e.stopPropagation()} onSubmit={submitCash}>
        {header}
        <div className="Popover_Body Single_Column">
          <div className="Form_Field">
            <div className="Tabs">
              {CASH_TRANSACTION_KINDS.map((option) => (
                <button key={option} type="button" className={kind === option ? 'Active' : ''} onClick={() => setKind(option)}>
                  {t(`portfolio.kind_${option}`)}
                </button>
              ))}
            </div>
            <span className="Field_Hint">{t(`portfolio.kindHint_${kind}`)}</span>
          </div>
          <div className="Portfolio_Pair">
            <div className="Form_Field">
              <label htmlFor="portfolio-amount">{t('portfolio.amount')} *</label>
              <Global_Input id="portfolio-amount" value={amount} onChange={(e) => setAmount(e.target.value)} />
            </div>
            <div className="Form_Field">
              <label htmlFor="portfolio-currency">{t('portfolio.currency')} *</label>
              <Global_Dropdown
                id="portfolio-currency"
                value={currencyId}
                onChange={(next) => {
                  setCurrencyId(String(next));
                  setBankAccountId(NONE);
                }}
                options={currencies.map((currency) => ({ value: currency.id, label: `${currency.shortCode} · ${currency.name}` }))}
              />
            </div>
          </div>
          <div className="Form_Field">
            <label htmlFor="portfolio-date">{t('portfolio.date')} *</label>
            <Global_Input id="portfolio-date" type="date" value={date} onChange={(e) => setDate(e.target.value)} />
          </div>
          <div className="Form_Field">
            <label htmlFor="portfolio-account">{t('portfolio.account')}</label>
            <Global_Dropdown
              id="portfolio-account"
              value={bankAccountId}
              onChange={(next) => setBankAccountId(String(next))}
              options={[
                { value: NONE, label: t('portfolio.noAccount') },
                ...accounts.map((account) => ({ value: account.id, label: account.name })),
              ]}
            />
          </div>
          <div className="Form_Field">
            <label htmlFor="portfolio-notes">{t('portfolio.notes')}</label>
            <Global_Input id="portfolio-notes" value={notes} maxLength={500} onChange={(e) => setNotes(e.target.value)} />
          </div>
          {errorLine}
        </div>
        <div className="Popover_Footer">
          <div className="Form_Action">
            <Simple_Button text={t('portfolio.back')} onClick={() => goTo('asset')} variant="Ghost" />
          </div>
          <div className="Form_Action">
            <Simple_Button type="submit" text={saving ? t('common.saving') : t('common.save')} disabled={saving || !valid} />
          </div>
        </div>
      </form>
    );
  }

  return createPortal(
    <div className="Popover_Backdrop" onClick={onClose}>
      {content}
    </div>,
    document.body,
  );
};

export default Portfolio_Transaction_Popover;

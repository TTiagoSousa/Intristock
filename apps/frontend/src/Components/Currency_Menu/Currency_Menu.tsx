import { useEffect, useMemo, useRef, useState } from 'react';
import { useLocation } from 'react-router';
import { useTranslation } from 'react-i18next';
import { useCurrency } from '../../Contexts/Currency_Context';
import './Currency_Menu.scss';

// As áreas que contam na moeda delas (o mercado, a simulação, a empresa): lá a
// escolha do topo não muda nada, por isso não aparece
const OWN_CURRENCY_AREAS = ['/Trading', '/Markets', '/Companies'];

/**
 * A moeda em que se vê o site (finanças pessoais, calculadoras…), ao lado do sino:
 * um botão como os outros do topo, com o símbolo da escolhida, e a lista por baixo,
 * com a escolhida em primeiro.
 */
const Currency_Menu = () => {
  const { t } = useTranslation();
  const { pathname } = useLocation();
  const { currencies, selectedCurrency, setSelectedCurrency } = useCurrency();
  const [open, setOpen] = useState(false);
  const [search, setSearch] = useState('');
  const ref = useRef<HTMLDivElement>(null);

  useEffect(() => {
    if (!open) return;
    const close = (event: MouseEvent) => {
      if (ref.current && !ref.current.contains(event.target as Node)) setOpen(false);
    };
    const escape = (event: KeyboardEvent) => {
      if (event.key === 'Escape') setOpen(false);
    };
    document.addEventListener('mousedown', close);
    document.addEventListener('keydown', escape);
    return () => {
      document.removeEventListener('mousedown', close);
      document.removeEventListener('keydown', escape);
    };
  }, [open]);

  const current = currencies.find((currency) => currency.shortCode === selectedCurrency);

  const list = useMemo(() => {
    const term = search.trim().toLowerCase();
    const others = currencies.filter(
      (currency) =>
        currency.shortCode !== selectedCurrency &&
        (!term || currency.shortCode.toLowerCase().includes(term) || currency.name.toLowerCase().includes(term)),
    );
    return current && !term ? [current, ...others] : others;
  }, [currencies, current, search, selectedCurrency]);

  if (OWN_CURRENCY_AREAS.some((area) => pathname.startsWith(area))) return null;

  const choose = (shortCode: string) => {
    setSelectedCurrency(shortCode);
    setOpen(false);
    setSearch('');
  };

  const label = `${t('settings.currency')}: ${selectedCurrency}`;

  return (
    <div className="Currency_Menu" ref={ref}>
      <button
        type="button"
        className="Icon_Button Currency_Menu_Button"
        onClick={() => setOpen((value) => !value)}
        aria-label={label}
        aria-expanded={open}
        title={label}
      >
        <span className="Currency_Menu_Symbol">{current?.symbol ?? selectedCurrency}</span>
      </button>

      {open && (
        <div className="Currency_Menu_Dropdown" role="dialog" aria-label={t('settings.currency')}>
          <div className="Currency_Menu_Head">
            <input
              className="Currency_Menu_Search"
              value={search}
              onChange={(event) => setSearch(event.target.value)}
              placeholder={t('common.search')}
              autoFocus
            />
          </div>

          {list.length === 0 ? (
            <span className="Currency_Menu_Empty">{t('common.noResults')}</span>
          ) : (
            <ul className="Currency_Menu_List">
              {list.map((currency) => (
                <li key={currency.id}>
                  <button
                    type="button"
                    className={`Currency_Menu_Item${currency.shortCode === selectedCurrency ? ' Selected' : ''}`}
                    onClick={() => choose(currency.shortCode)}
                  >
                    <span className="Currency_Menu_Item_Symbol">{currency.symbol}</span>
                    <span className="Currency_Menu_Item_Code">{currency.shortCode}</span>
                    <span className="Currency_Menu_Item_Name">{currency.name}</span>
                  </button>
                </li>
              ))}
            </ul>
          )}
        </div>
      )}
    </div>
  );
};

export default Currency_Menu;

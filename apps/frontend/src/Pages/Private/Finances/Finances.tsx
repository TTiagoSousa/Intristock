import { useNavigate } from 'react-router';
import { useTranslation } from 'react-i18next';
import { useCurrency } from '../../../Contexts/Currency_Context';
import { useCurrencyFormat } from '../../../Hooks/useCurrencyFormat';
import { useIncomeSummary } from '../../../Hooks/Finances/usePersonalIncome';
import { useExpenseSummary } from '../../../Hooks/Finances/usePersonalExpense';
import { useDebtSummary } from '../../../Hooks/Finances/usePersonalDebt';
import './Finances.scss';

/**
 * A visão geral das finanças pessoais: os ganhos e as despesas deste mês (dos
 * dashboards deles, na moeda escolhida nas definições), o património e o total
 * em dívida (o património ainda sem dados).
 */
const Finances = () => {
  const { t } = useTranslation();
  const navigate = useNavigate();
  const { currencies, selectedCurrency } = useCurrency();
  const { formatIn } = useCurrencyFormat();
  const currencyId = currencies.find((currency) => currency.shortCode === selectedCurrency)?.id;
  const { data: incomes } = useIncomeSummary(1, 0, currencyId);
  const { data: expenses } = useExpenseSummary(1, currencyId);
  const { data: debts } = useDebtSummary(1, 0, currencyId);

  const code = incomes?.currency?.shortCode ?? selectedCurrency;
  const earned = incomes?.cards.receivedThisMonth ?? null;
  const spent = expenses?.cards.thisMonth ?? null;

  return (
    <div className="Finances">
      <div className="Page_Head">
        <h1>{t('finances.title')}</h1>
      </div>
      <div className="Grid Auto_190">
        <button type="button" className="Card Tile Wave_Tile Up Finances_Tile" onClick={() => navigate('/Finances/ganhos')}>
          <span className="Eyebrow">{t('finances.cardEarnings')}</span>
          <span className="Tile_Value">{earned === null ? '—' : formatIn(earned, code)}</span>
          <div className="Tile_Foot">
            {incomes ? t('finances.cardEarningsFoot', { amount: formatIn(incomes.cards.pending, code) }) : ''}
          </div>
        </button>
        <button type="button" className="Card Tile Wave_Tile Down Finances_Tile" onClick={() => navigate('/Finances/despesas')}>
          <span className="Eyebrow">{t('finances.cardExpenses')}</span>
          <span className="Tile_Value">{spent === null ? '—' : formatIn(spent, code)}</span>
          <div className="Tile_Foot">
            {earned !== null && spent !== null ? t('finances.cardBalance', { amount: formatIn(earned - spent, code) }) : ''}
          </div>
        </button>
        <div className="Card Tile Wave_Tile Gold">
          <span className="Eyebrow">{t('finances.cardWealth')}</span>
          <span className="Tile_Value">—</span>
          <div className="Tile_Foot">{t('finances.soon')}</div>
        </div>
        <button type="button" className="Card Tile Wave_Tile Warn Finances_Tile" onClick={() => navigate('/Finances/dividas')}>
          <span className="Eyebrow">{t('finances.cardDebt')}</span>
          <span className="Tile_Value">{debts ? formatIn(debts.cards.owed, debts.currency?.shortCode ?? code) : '—'}</span>
          <div className="Tile_Foot">
            {debts
              ? t('finances.cardDebtFoot', { amount: formatIn(debts.cards.monthlyInstallments, debts.currency?.shortCode ?? code) })
              : ''}
          </div>
        </button>
      </div>
    </div>
  );
};

export default Finances;

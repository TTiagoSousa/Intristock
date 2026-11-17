import { useTranslation } from 'react-i18next';
import { useCurrencyFormat } from '../../../../Hooks/useCurrencyFormat';
import type { useDayRates } from '../../../../Hooks/Finances/useDayRates';
import { KIND_SIGN, POSITION_KINDS, type Portfolio_Transaction } from '../../../../Hooks/Finances/usePersonalPortfolio';
import Converted_Amount from '../Earnings/Converted_Amount';

type Rated = ReturnType<typeof useDayRates>;

const quantityFormat = new Intl.NumberFormat(undefined, { maximumFractionDigits: 6 });

/**
 * O valor de uma transação numa linha: o dinheiro com sinal (entra a verde) na moeda do
 * topo, ou, numa compra, venda ou acerto de ações, o valor sem sinal e a quantidade × o
 * preço por baixo (o dinheiro dela está na linha do portefólio do dinheiro).
 */
export const Transaction_Amount = ({ tx, rated }: { tx: Portfolio_Transaction; rated: Rated }) => {
  const { t } = useTranslation();
  const { formatIn } = useCurrencyFormat();
  const day = tx.date.slice(0, 10);
  const amount = Number(tx.amount);
  const quantity = Number(tx.quantity);

  if (POSITION_KINDS.includes(tx.kind))
    return (
      <td className="Right Num">
        {amount ? <Converted_Amount value={rated.money(amount, tx.currency, day)} /> : '—'}
        <div className="Earnings_Sub">
          {amount && quantity
            ? t('portfolio.quantityAt', {
                quantity: quantityFormat.format(Math.abs(quantity)),
                price: formatIn(amount / Math.abs(quantity), tx.currency.shortCode),
              })
            : `${quantity > 0 ? '+' : ''}${quantityFormat.format(quantity)}`}
        </div>
      </td>
    );

  const signed = (KIND_SIGN[tx.kind] ?? 0) * amount;
  return (
    <td className={`Right Num ${signed > 0 ? 'Portfolio_In' : 'Portfolio_Out'}`}>
      <Converted_Amount value={rated.money(signed, tx.currency, day)} />
    </td>
  );
};

/** O ativo de uma transação: o nome e, nas ações, o ticker da corretora por baixo. */
export const Transaction_Asset = ({ tx }: { tx: Portfolio_Transaction }) => (
  <td>
    {tx.asset.name}
    {tx.instrument && <div className="Earnings_Sub">{tx.instrument.symbol}</div>}
  </td>
);

import { useEffect, useMemo, useState } from 'react';
import http from '../../Service/httpService';
import { End_Points } from '../../Service/endPoints';
import { useCurrency } from '../../Contexts/Currency_Context';
import { useCurrencyFormat } from '../useCurrencyFormat';

type Rated_Currency = { id: string; shortCode: string; symbol?: string };

/** Um valor a mostrar: a moeda dele e o dia (sem dia, ou no futuro, conta o de hoje). */
export type Rated_Item = { currency: Rated_Currency | null | undefined; date?: string | null };

interface Day_Rates {
  to: string;
  today: string;
  rates: Record<string, number>;
  estimatedRates: number;
}

/**
 * Os Registos das finanças pessoais na moeda escolhida no topo: as cotações do
 * dia de cada valor vêm do backend de uma vez (`POST /currency/day-rates`) e
 * `money` escreve o valor convertido e, se a moeda dele for outra, o original
 * por baixo. Enquanto as cotações não chegam (ou sem a da moeda), fica o original.
 */
export const useDayRates = (items: Rated_Item[]) => {
  const { currencies, selectedCurrency } = useCurrency();
  const { formatIn } = useCurrencyFormat();
  const target = currencies.find((currency) => currency.shortCode === selectedCurrency) ?? null;
  const [data, setData] = useState<Day_Rates | null>(null);

  // Só se pede outra vez quando mudam as moedas ou os dias
  const key = useMemo(() => {
    if (!target) return '';
    const pairs = new Set<string>();
    for (const item of items)
      if (item.currency && item.currency.id !== target.id)
        pairs.add(`${(item.date ?? '').slice(0, 10)}|${item.currency.id}`);
    return [...pairs].sort().join(',');
  }, [items, target]);

  useEffect(() => {
    if (!target || !key) return;
    let cancelled = false;
    const body = {
      to: target.id,
      items: key.split(',').map((pair) => {
        const [day, from] = pair.split('|');
        return day ? { from, day } : { from };
      }),
    };
    http
      .post<Day_Rates>(End_Points.Currency_Day_Rates_Endpoint(), body)
      .then((response) => {
        if (!cancelled) setData(response.data);
      })
      .catch(() => {
        // Sem cotações fica cada valor na moeda dele
        if (!cancelled) setData(null);
      });
    return () => {
      cancelled = true;
    };
  }, [key, target]);

  /** O valor em `target`, ou nulo se ainda não há a cotação. */
  const convert = (amount: number, currency: Rated_Currency | null | undefined, date?: string | null) => {
    if (!currency || !target) return null;
    if (currency.id === target.id) return amount;
    if (!data || data.to !== target.id) return null;
    const day = date && date.slice(0, 10) < data.today ? date.slice(0, 10) : data.today;
    const rate = data.rates[`${day}|${currency.id}`];
    return rate === undefined ? null : amount * rate;
  };

  /** O texto principal e o original (só quando é outra moeda e já se converteu). */
  const money = (amount: number, currency: Rated_Currency | null | undefined, date?: string | null) => {
    const value = convert(amount, currency, date);
    const original = formatIn(amount, currency);
    if (value === null || !target || currency?.id === target.id) return { main: original, original: null };
    return { main: formatIn(value, target.shortCode), original };
  };

  /** A soma em `target`; os que ainda não têm cotação somam-se à parte, cada um na moeda dele. */
  const total = (rows: { amount: number; currency: Rated_Currency | null | undefined; date?: string | null }[]) => {
    let sum = 0;
    let converted = 0;
    const others: Record<string, number> = {};
    for (const row of rows) {
      const value = convert(row.amount, row.currency, row.date);
      if (value !== null) {
        sum += value;
        converted += 1;
      } else if (row.currency)
        others[row.currency.shortCode] = (others[row.currency.shortCode] ?? 0) + row.amount;
    }
    const parts = [
      ...(converted ? [formatIn(sum, target?.shortCode)] : []),
      ...Object.entries(others).map(([code, value]) => formatIn(value, code)),
    ];
    return parts.join(' + ') || '—';
  };

  return { convert, money, total, estimatedRates: data?.estimatedRates ?? 0 };
};

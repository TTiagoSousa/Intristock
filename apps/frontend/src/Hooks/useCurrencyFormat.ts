import { useCurrency } from '../Contexts/Currency_Context';

/** O mínimo que é preciso saber de uma moeda para escrever um valor nela. */
interface FormattableCurrency {
  symbol: string;
  symbolFirst: boolean;
  decimalMark: string;
  thousandsSeparator: string;
}

const FALLBACK: FormattableCurrency = {
  symbol: '€',
  symbolFirst: false,
  decimalMark: ',',
  thousandsSeparator: '.',
};

export const useCurrencyFormat = () => {
  const { currencies, selectedCurrency } = useCurrency();

  const selected = currencies.find((c) => c.shortCode === selectedCurrency);

  const write = (value: number, currency: FormattableCurrency, decimals: number) => {
    const [integerPart, decimalPart] = value.toFixed(decimals).split('.');
    const withThousands = integerPart.replace(
      /\B(?=(\d{3})+(?!\d))/g,
      currency.thousandsSeparator,
    );
    const formatted = `${withThousands}${currency.decimalMark}${decimalPart}`;

    return currency.symbolFirst ? `${currency.symbol}${formatted}` : `${formatted}${currency.symbol}`;
  };

  /**
   * Escreve um valor **na moeda escolhida nas definições**.
   *
   * Só se usa em números que não têm moeda própria — os resultados das
   * calculadoras, onde quem escreve "10000" está a dizer dez mil na moeda em
   * que está a pensar. Não converte nada, porque não há nada de onde converter.
   *
   * `decimals` sobe para 4 nos custos unitários: a 2 casas, um filamento a
   * 0,0175 €/g apareceria como 0,02 € e a conta deixava de fechar.
   */
  const formatAmount = (value: number, decimals = 2) =>
    write(value, selected ?? FALLBACK, decimals);

  /**
   * Escreve um valor **na moeda a que ele pertence**.
   *
   * É isto que as páginas de empresa usam. Um pagamento feito em dólares
   * mostra-se em dólares, um ativo comprado em euros mostra-se em euros — o
   * seletor das definições é uma preferência de quem está a ver e não muda o
   * que o número é. Antes, formatar tudo com o símbolo escolhido punha "R$100"
   * ao lado de um valor que eram cem euros.
   *
   * A conversão de facto, quando é precisa, faz-se no backend à taxa da data
   * certa — não aqui, que não sabe de que dia é o valor.
   */
  const formatIn = (
    value: number,
    currency: Partial<FormattableCurrency> & { shortCode?: string } | string | null | undefined,
    decimals = 2,
  ) => {
    // O backend manda quase sempre só `{ id, shortCode, symbol }` nas relações
    // — os separadores e a posição do símbolo ficam de fora para não engordar
    // cada linha de cada tabela. Resolvem-se aqui pela lista que o contexto já
    // carregou, e só se cai no que veio quando a moeda não está nessa lista.
    const shortCode = typeof currency === 'string' ? currency : currency?.shortCode;
    const known = shortCode ? currencies.find((c) => c.shortCode === shortCode) : undefined;
    const partial = typeof currency === 'string' ? undefined : currency;

    const resolved: FormattableCurrency = known ?? {
      symbol: partial?.symbol ?? selected?.symbol ?? FALLBACK.symbol,
      symbolFirst: partial?.symbolFirst ?? selected?.symbolFirst ?? FALLBACK.symbolFirst,
      decimalMark: partial?.decimalMark ?? selected?.decimalMark ?? FALLBACK.decimalMark,
      thousandsSeparator:
        partial?.thousandsSeparator ?? selected?.thousandsSeparator ?? FALLBACK.thousandsSeparator,
    };

    return write(value, resolved, decimals);
  };

  return { formatAmount, formatIn, symbol: selected?.symbol ?? FALLBACK.symbol };
};

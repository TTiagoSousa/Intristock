import {
  applyToPosition,
  CASH_SIGN,
  compareLedger,
  emptyPosition,
  IN_KIND,
  inKindFlow,
  POSITION_SIGN,
  priceCurrency,
  priceMarketOf,
} from './portfolioLedger';

describe('portfolioLedger', () => {
  describe('CASH_SIGN e POSITION_SIGN', () => {
    it('o que entra no dinheiro soma, o que sai tira', () => {
      for (const kind of ['deposit', 'interest', 'dividend', 'transfer_in'])
        expect(CASH_SIGN[kind]).toBe(1);
      for (const kind of ['withdrawal', 'fee', 'tax', 'transfer_out'])
        expect(CASH_SIGN[kind]).toBe(-1);
      // Uma compra não mexe no dinheiro deste lado (sai noutra linha, transfer_out)
      expect(CASH_SIGN.buy).toBeUndefined();
    });

    it('as compras somam quantidade, as vendas tiram, a avaliação não mexe', () => {
      expect(POSITION_SIGN).toEqual({ buy: 1, sell: -1, adjust: 1, valuation: 0 });
    });

    it('o saldo de uma série de movimentos', () => {
      const moves: [string, number][] = [
        ['deposit', 1000],
        ['interest', 2.5],
        ['fee', 1],
        ['transfer_out', 300],
        ['withdrawal', 100],
        // uma comissão devolvida: o tipo fica, o valor vem negativo
        ['fee', -0.5],
      ];
      const balance = moves.reduce((sum, [kind, amount]) => sum + CASH_SIGN[kind] * amount, 0);
      expect(balance).toBeCloseTo(602, 10);
    });
  });

  describe('inKindFlow', () => {
    it('um bem sem dinheiro conta como entrada (compra) ou saída (venda) de fora', () => {
      expect(inKindFlow('buy', IN_KIND, 5000)).toBe(5000);
      expect(inKindFlow('sell', IN_KIND, 4000)).toBe(-4000);
      expect(inKindFlow('valuation', IN_KIND, 4500)).toBe(0);
    });
    it('sem in_kind não há fluxo', () => {
      expect(inKindFlow('buy', null, 5000)).toBe(0);
      expect(inKindFlow('buy', undefined, 5000)).toBe(0);
      expect(inKindFlow('buy', 'order', 5000)).toBe(0);
    });
  });

  describe('priceCurrency', () => {
    it('GBX vale libras ÷ 100', () => {
      expect(priceCurrency('GBX')).toEqual({ code: 'GBP', factor: 0.01 });
    });
    it('as stablecoins do dólar contam como USD', () => {
      expect(priceCurrency('USDT')).toEqual({ code: 'USD', factor: 1 });
      expect(priceCurrency('USDC')).toEqual({ code: 'USD', factor: 1 });
    });
    it('o resto fica como está', () => {
      expect(priceCurrency('EUR')).toEqual({ code: 'EUR', factor: 1 });
    });
  });

  describe('priceMarketOf', () => {
    const yahoo = { id: 'y', symbol: 'CCC3.DE', quote: 'EUR', source: 'yahoo', type: 'stock' };
    it('o mercado do preço indicado vem primeiro', () => {
      expect(
        priceMarketOf({ id: 't', symbol: 'CCC3d_EQ', quote: 'EUR', source: 'trading212', type: 'stock', priceInstrument: yahoo }),
      ).toBe(yahoo);
    });
    it('um mercado que dá preço é ele próprio', () => {
      expect(
        priceMarketOf({ id: 'b', symbol: 'BTCUSDT', quote: 'USDT', source: 'binance', type: 'spot', priceInstrument: null }),
      ).toEqual({ id: 'b', symbol: 'BTCUSDT', quote: 'USDT', source: 'binance', type: 'spot' });
    });
    it('sem preço, nulo', () => {
      expect(
        priceMarketOf({ id: 't', symbol: 'X', quote: 'EUR', source: 'trading212', type: 'stock', priceInstrument: null }),
      ).toBeNull();
      expect(priceMarketOf(null)).toBeNull();
    });
  });

  describe('compareLedger', () => {
    it('ordena pelo instante, com a avaliação depois no mesmo instante e depois pela criação', () => {
      const day = new Date('2026-11-10T00:00:00Z');
      const rows = [
        { id: 'valuation', date: day, kind: 'valuation', createdAt: new Date(1) },
        { id: 'buy2', date: day, kind: 'buy', createdAt: new Date(3) },
        { id: 'buy1', date: day, kind: 'buy', createdAt: new Date(2) },
        { id: 'early', date: day, externalAt: new Date('2026-11-09T10:00:00Z'), kind: 'buy' },
      ];
      expect([...rows].sort(compareLedger).map((row) => row.id)).toEqual(['early', 'buy1', 'buy2', 'valuation']);
    });
  });

  describe('applyToPosition (custo médio ponderado)', () => {
    it('as compras juntam a quantidade e o custo', () => {
      const position = emptyPosition();
      applyToPosition(position, 'buy', 10, 100);
      applyToPosition(position, 'buy', 10, 200);
      expect(position.quantity).toBe(20);
      expect(position.cost).toBe(300);
      // custo médio 15
      expect(position.cost / position.quantity).toBe(15);
      expect(position.lastUnitPrice).toBe(20);
      expect(position.realized).toBe(0);
    });

    it('uma venda tira a parte do custo médio e dá o realizado', () => {
      const position = emptyPosition();
      applyToPosition(position, 'buy', 10, 100);
      applyToPosition(position, 'buy', 10, 200);
      // vende 5 a 30 = 150; o custo dessas 5 é 75
      applyToPosition(position, 'sell', 5, 150);
      expect(position.quantity).toBe(15);
      expect(position.cost).toBe(225);
      expect(position.realized).toBe(75);
      expect(position.lastUnitPrice).toBe(30);
      // o custo médio do que fica não muda
      expect(position.cost / position.quantity).toBe(15);
    });

    it('uma venda com perda dá realizado negativo', () => {
      const position = emptyPosition();
      applyToPosition(position, 'buy', 4, 400);
      applyToPosition(position, 'sell', 1, 80);
      expect(position.realized).toBe(-20);
      expect(position.cost).toBe(300);
    });

    it('vender tudo fecha a posição (quantidade e custo a 0)', () => {
      const position = emptyPosition();
      applyToPosition(position, 'buy', 0.1, 10);
      applyToPosition(position, 'buy', 0.2, 30);
      applyToPosition(position, 'sell', 0.3, 60);
      expect(position.quantity).toBe(0);
      expect(position.cost).toBe(0);
      expect(position.realized).toBeCloseTo(20, 10);
    });

    it('um split (adjust) muda a quantidade e não o custo', () => {
      const position = emptyPosition();
      applyToPosition(position, 'buy', 10, 1000);
      applyToPosition(position, 'adjust', 30, 0);
      expect(position.quantity).toBe(40);
      expect(position.cost).toBe(1000);
      expect(position.cost / position.quantity).toBe(25);
    });

    it('uma avaliação muda o último preço pelo valor do que se tem', () => {
      const position = emptyPosition();
      applyToPosition(position, 'buy', 1, 5000);
      applyToPosition(position, 'valuation', 0, 4200);
      expect(position.quantity).toBe(1);
      expect(position.cost).toBe(5000);
      expect(position.lastUnitPrice).toBe(4200);
    });
  });
});

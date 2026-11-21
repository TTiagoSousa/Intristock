import { describe, expect, it } from 'vitest';
import { localeOf } from './locale';

describe('localeOf', () => {
  it('pt é o português europeu (o Intl leria pt como pt-BR)', () => {
    expect(localeOf('pt')).toBe('pt-PT');
    expect(new Intl.NumberFormat(localeOf('pt')).format(1234.5)).toBe('1234,5');
  });

  it('o resto é inglês britânico', () => {
    expect(localeOf('en')).toBe('en-GB');
    expect(localeOf('fr')).toBe('en-GB');
  });
});

import { afterAll, beforeAll, describe, expect, it, vi } from 'vitest';
import { safeNextPath } from './nextPath';

beforeAll(() => {
  // Os testes correm em Node: só o que o helper lê do window
  vi.stubGlobal('window', { location: { origin: 'https://intristock.local' } });
});

afterAll(() => {
  vi.unstubAllGlobals();
});

describe('safeNextPath', () => {
  it('aceita caminhos desta app, com a pesquisa e o hash', () => {
    expect(safeNextPath('/Finances/ganhos')).toBe('/Finances/ganhos');
    expect(safeNextPath('/Trading/simulacoes?view=hours#x')).toBe('/Trading/simulacoes?view=hours#x');
  });

  it('sem valor dá o fallback', () => {
    expect(safeNextPath(null)).toBe('/Dashboard');
    expect(safeNextPath(undefined)).toBe('/Dashboard');
    expect(safeNextPath('')).toBe('/Dashboard');
    expect(safeNextPath(null, '/Outro')).toBe('/Outro');
  });

  it('recusa URLs de outro site e caminhos relativos', () => {
    expect(safeNextPath('https://evil.example/x')).toBe('/Dashboard');
    expect(safeNextPath('http://intristock.local/x')).toBe('/Dashboard');
    expect(safeNextPath('javascript:alert(1)')).toBe('/Dashboard');
    expect(safeNextPath('Dashboard')).toBe('/Dashboard');
  });

  it('recusa // e /\\ (o browser lê-os como outro domínio)', () => {
    expect(safeNextPath('//evil.example')).toBe('/Dashboard');
    expect(safeNextPath('/\\evil.example')).toBe('/Dashboard');
  });

  it('recusa o que o browser transforma noutro domínio (tabs e quebras de linha)', () => {
    expect(safeNextPath('/\t/evil.example')).toBe('/Dashboard');
    expect(safeNextPath('/\n/evil.example')).toBe('/Dashboard');
  });

  it('não volta ao login nem à raiz', () => {
    expect(safeNextPath('/')).toBe('/Dashboard');
    expect(safeNextPath('/Auth')).toBe('/Dashboard');
    expect(safeNextPath('/Auth?next=/x')).toBe('/Dashboard');
  });
});

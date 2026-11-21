import { createCipheriv, createHash, randomBytes } from 'crypto';
import { decryptSecret, encryptSecret, secretContext } from './secret-box';

const KEY_TEXT = 'test-encryption-key';

// Um valor como a v1 o gravava: AES-256-GCM sem AAD
const encryptV1 = (plain: string) => {
  const iv = randomBytes(12);
  const key = createHash('sha256').update(KEY_TEXT).digest();
  const cipher = createCipheriv('aes-256-gcm', key, iv);
  const data = Buffer.concat([cipher.update(plain, 'utf8'), cipher.final()]);
  return ['v1', iv.toString('base64'), cipher.getAuthTag().toString('base64'), data.toString('base64')].join(':');
};

describe('secret-box', () => {
  const previous = process.env.ENCRYPTION_KEY;
  beforeEach(() => {
    process.env.ENCRYPTION_KEY = KEY_TEXT;
  });
  afterAll(() => {
    if (previous === undefined) delete process.env.ENCRYPTION_KEY;
    else process.env.ENCRYPTION_KEY = previous;
  });

  const context = secretContext('BrokerConnection', 'user-1', 'apiSecret');

  it('o contexto é tabela:dono:campo', () => {
    expect(context).toBe('BrokerConnection:user-1:apiSecret');
  });

  it('v2: cifra e decifra com o mesmo contexto', () => {
    const payload = encryptSecret('segredo ção 🔑', context);
    expect(payload.startsWith('v2:')).toBe(true);
    expect(payload.split(':')).toHaveLength(4);
    expect(payload).not.toContain('segredo');
    expect(decryptSecret(payload, context)).toBe('segredo ção 🔑');
  });

  it('cada cifra tem um iv novo', () => {
    expect(encryptSecret('x', context)).not.toBe(encryptSecret('x', context));
  });

  it('v2: outro contexto (outra pessoa, outro campo) não decifra', () => {
    const payload = encryptSecret('segredo', context);
    expect(() => decryptSecret(payload, secretContext('BrokerConnection', 'user-2', 'apiSecret'))).toThrow();
    expect(() => decryptSecret(payload, secretContext('BrokerConnection', 'user-1', 'apiKey'))).toThrow();
  });

  it('um valor adulterado não decifra', () => {
    const [version, iv, tag, data] = encryptSecret('segredo', context).split(':');
    const bytes = Buffer.from(data, 'base64');
    bytes[0] ^= 1;
    expect(() => decryptSecret([version, iv, tag, bytes.toString('base64')].join(':'), context)).toThrow();
  });

  it('v1 (sem AAD) continua a ler-se, seja qual for o contexto', () => {
    const payload = encryptV1('antigo');
    expect(decryptSecret(payload, context)).toBe('antigo');
    expect(decryptSecret(payload, 'outro:contexto:qualquer')).toBe('antigo');
  });

  it('outra chave não decifra', () => {
    const payload = encryptSecret('segredo', context);
    process.env.ENCRYPTION_KEY = 'outra-chave';
    expect(() => decryptSecret(payload, context)).toThrow();
  });

  it('formato desconhecido é recusado', () => {
    expect(() => decryptSecret('v3:a:b:c', context)).toThrow('formato desconhecido');
    expect(() => decryptSecret('v2:a:b', context)).toThrow('formato desconhecido');
    expect(() => decryptSecret('texto simples', context)).toThrow('formato desconhecido');
  });

  it('sem ENCRYPTION_KEY não cifra', () => {
    delete process.env.ENCRYPTION_KEY;
    expect(() => encryptSecret('x', context)).toThrow('ENCRYPTION_KEY');
  });
});

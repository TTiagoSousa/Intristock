import { createCipheriv, createDecipheriv, createHash, randomBytes } from 'crypto';

// AES-256-GCM: cifra e autentica — um valor adulterado na base de dados falha a
// decifrar em vez de devolver lixo
const ALGORITHM = 'aes-256-gcm';
const VERSION = 'v1';

/**
 * A chave sai da ENCRYPTION_KEY do ambiente (gerada na instalação, nunca na base
 * de dados). Passa por SHA-256 para dar sempre os 32 bytes do AES-256, seja qual
 * for o comprimento do texto do ambiente.
 */
function encryptionKey(): Buffer {
  const raw = process.env.ENCRYPTION_KEY;
  if (!raw) {
    throw new Error('ENCRYPTION_KEY em falta no ambiente — sem ela não se guardam chaves de API');
  }
  return createHash('sha256').update(raw).digest();
}

/** Devolve `v1:<iv>:<tag>:<dados>`, tudo em base64. */
export function encryptSecret(plain: string): string {
  const iv = randomBytes(12);
  const cipher = createCipheriv(ALGORITHM, encryptionKey(), iv);
  const data = Buffer.concat([cipher.update(plain, 'utf8'), cipher.final()]);
  const tag = cipher.getAuthTag();
  return [VERSION, iv.toString('base64'), tag.toString('base64'), data.toString('base64')].join(':');
}

export function decryptSecret(payload: string): string {
  const [version, iv, tag, data] = payload.split(':');
  if (version !== VERSION || !iv || !tag || !data) {
    throw new Error('Valor cifrado em formato desconhecido');
  }
  const decipher = createDecipheriv(ALGORITHM, encryptionKey(), Buffer.from(iv, 'base64'));
  decipher.setAuthTag(Buffer.from(tag, 'base64'));
  return Buffer.concat([decipher.update(Buffer.from(data, 'base64')), decipher.final()]).toString('utf8');
}

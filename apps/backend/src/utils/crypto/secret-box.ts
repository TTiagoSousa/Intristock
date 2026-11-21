import { createCipheriv, createDecipheriv, createHash, randomBytes } from 'crypto';

// AES-256-GCM: cifra e autentica — um valor adulterado na base de dados falha a
// decifrar em vez de devolver lixo
const ALGORITHM = 'aes-256-gcm';
// v2: com AAD (o contexto). A v1, sem ele, continua a ler-se; passa a v2 quando o
// valor se grava outra vez
const VERSION = 'v2';
const LEGACY_VERSION = 'v1';

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

/**
 * O contexto de um valor cifrado (`tabela:dono:campo`): entra como AAD, por isso um
 * valor copiado para outra linha (de outra pessoa, de outra empresa) ou para outro
 * campo deixa de decifrar. O dono é o que já se sabe antes de gravar (a pessoa, a
 * empresa, o tipo de API), não o id da linha.
 */
export function secretContext(table: string, owner: string, field: string): string {
  return `${table}:${owner}:${field}`;
}

/** Devolve `v2:<iv>:<tag>:<dados>`, tudo em base64, autenticado com o `context`. */
export function encryptSecret(plain: string, context: string): string {
  const iv = randomBytes(12);
  const cipher = createCipheriv(ALGORITHM, encryptionKey(), iv);
  cipher.setAAD(Buffer.from(context, 'utf8'));
  const data = Buffer.concat([cipher.update(plain, 'utf8'), cipher.final()]);
  const tag = cipher.getAuthTag();
  return [VERSION, iv.toString('base64'), tag.toString('base64'), data.toString('base64')].join(':');
}

/** Decifra um valor v2 com o mesmo `context` com que foi cifrado (ou um v1, sem ele). */
export function decryptSecret(payload: string, context: string): string {
  const [version, iv, tag, data] = payload.split(':');
  if ((version !== VERSION && version !== LEGACY_VERSION) || !iv || !tag || !data) {
    throw new Error('Valor cifrado em formato desconhecido');
  }
  const decipher = createDecipheriv(ALGORITHM, encryptionKey(), Buffer.from(iv, 'base64'));
  if (version === VERSION) decipher.setAAD(Buffer.from(context, 'utf8'));
  decipher.setAuthTag(Buffer.from(tag, 'base64'));
  return Buffer.concat([decipher.update(Buffer.from(data, 'base64')), decipher.final()]).toString('utf8');
}

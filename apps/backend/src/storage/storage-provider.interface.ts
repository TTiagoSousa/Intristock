import { Readable } from 'stream';

/**
 * Contrato mínimo de onde os ficheiros vivem.
 *
 * Todos os fornecedores que interessam falam a API do S3 (Garage, MinIO,
 * Cloudflare R2, AWS, Backblaze), por isso na prática há só uma implementação
 * e o que muda entre eles é o endpoint. A interface existe à mesma para o dia
 * em que aparecer algo que não fale S3 — e para o `storageProvider` gravado em
 * cada documento ter onde encaixar.
 */
export interface StorageProvider {
  // Nome com que fica marcado cada documento gravado por este provider
  readonly name: string;

  put(key: string, body: Buffer, contentType: string): Promise<void>;
  get(key: string): Promise<Readable>;
  delete(key: string): Promise<void>;
}

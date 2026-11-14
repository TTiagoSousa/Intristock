import { BadRequestException, Injectable } from '@nestjs/common';
import { randomUUID } from 'crypto';
import { extname } from 'path';
import { S3StorageProvider } from './providers/s3.provider';
import { StorageProvider } from './storage-provider.interface';

@Injectable()
export class StorageService {
  constructor(private readonly s3: S3StorageProvider) {}

  // Onde os ficheiros novos vão parar
  private get defaultProvider(): StorageProvider {
    return this.s3;
  }

  /**
   * Cada documento guarda o provider onde foi gravado. No dia em que se ligar
   * outro storage, os documentos antigos continuam a ser lidos de onde estão —
   * não é preciso copiar nada para trocar.
   */
  private providerByName(name?: string): StorageProvider {
    if (!name || name === this.s3.name) return this.s3;

    throw new BadRequestException(`Storage desconhecido: "${name}"`);
  }

  get providerName(): string {
    return this.defaultProvider.name;
  }

  /**
   * A chave é sempre nova e inclui o id da empresa e do pagamento, para os
   * ficheiros serem arrumáveis e inspecionáveis no bucket.
   *
   * O nome original **não** entra na chave: viria do cliente e podia trazer
   * barras ou `..` e escapar do prefixo. Fica só na base de dados, e da
   * extensão aproveita-se apenas o que for letras e dígitos.
   */
  /** O mesmo, para os documentos de um membro (contratos e afins). */
  buildMemberKey(companyId: string, memberId: string, fileName: string) {
    const rawExtension = extname(fileName).replace('.', '').toLowerCase();
    const extension = /^[a-z0-9]{1,10}$/.test(rawExtension) ? `.${rawExtension}` : '';

    return `companies/${companyId}/members/${memberId}/${randomUUID()}${extension}`;
  }

  buildKey(companyId: string, paymentId: string, fileName: string) {
    const rawExtension = extname(fileName).replace('.', '').toLowerCase();
    const extension = /^[a-z0-9]{1,10}$/.test(rawExtension) ? `.${rawExtension}` : '';

    return `companies/${companyId}/payments/${paymentId}/${randomUUID()}${extension}`;
  }

  async put(key: string, body: Buffer, contentType: string) {
    await this.defaultProvider.put(key, body, contentType);
  }

  async get(key: string, provider?: string) {
    return this.providerByName(provider).get(key);
  }

  async delete(key: string, provider?: string) {
    await this.providerByName(provider).delete(key);
  }
}

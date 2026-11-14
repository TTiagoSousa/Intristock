import { Injectable, InternalServerErrorException, NotFoundException } from '@nestjs/common';
import {
  DeleteObjectCommand,
  GetObjectCommand,
  PutObjectCommand,
  S3Client,
} from '@aws-sdk/client-s3';
import { Readable } from 'stream';
import { StorageProvider } from '../storage-provider.interface';

/**
 * Serve qualquer storage compatível com S3. Hoje aponta a um Garage
 * self-host; trocar para Cloudflare R2 ou AWS é mudar as variáveis do .env,
 * sem tocar em código.
 */
@Injectable()
export class S3StorageProvider implements StorageProvider {
  // Vem do .env para os documentos ficarem marcados com o sítio de onde vieram
  readonly name = process.env.S3_PROVIDER ?? 's3';

  private readonly bucket = process.env.S3_BUCKET ?? '';

  private readonly client = new S3Client({
    endpoint: process.env.S3_ENDPOINT,
    region: process.env.S3_REGION ?? 'us-east-1',
    credentials: {
      accessKeyId: process.env.S3_ACCESS_KEY ?? '',
      secretAccessKey: process.env.S3_SECRET_KEY ?? '',
    },
    // Fora da AWS o endereço é endpoint/bucket/chave. Sem isto o SDK tenta
    // bucket.dominio.com, que num self-host não existe.
    forcePathStyle: true,
  });

  async put(key: string, body: Buffer, contentType: string): Promise<void> {
    await this.client.send(
      new PutObjectCommand({
        Bucket: this.bucket,
        Key: key,
        Body: body,
        ContentType: contentType,
      }),
    );
  }

  async get(key: string): Promise<Readable> {
    const response = await this.client.send(
      new GetObjectCommand({ Bucket: this.bucket, Key: key }),
    );

    if (!response.Body) {
      throw new NotFoundException('Ficheiro não encontrado no storage');
    }

    // O SDK devolve tipos diferentes conforme o ambiente; em Node é sempre
    // um Readable, mas o tipo não o garante
    if (!(response.Body instanceof Readable)) {
      throw new InternalServerErrorException('Resposta inesperada do storage');
    }

    return response.Body;
  }

  async delete(key: string): Promise<void> {
    await this.client.send(new DeleteObjectCommand({ Bucket: this.bucket, Key: key }));
  }
}

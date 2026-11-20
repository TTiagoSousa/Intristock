import { Injectable } from '@nestjs/common';
import { PrismaService } from 'src/prisma/prisma.service';
import { ApiKey } from 'src/generated/prisma/client/client';
import { ApiKeyRepository, ApiKeyUsage, ApiKeyView } from '../api-key-repository';

@Injectable()
export class PrismaApiKeyRepository implements ApiKeyRepository {
  constructor(private readonly prisma: PrismaService) {}

  async findViews(kind: string): Promise<ApiKeyView[]> {
    return this.prisma.apiKey.findMany({
      where: { kind },
      omit: { key: true },
      orderBy: [{ position: 'asc' }, { createdAt: 'asc' }],
    });
  }

  async findUsable(kind: string, now: Date): Promise<ApiKey[]> {
    return this.prisma.apiKey.findMany({
      where: { kind, active: true, OR: [{ exhaustedUntil: null }, { exhaustedUntil: { lte: now } }] },
      orderBy: [{ position: 'asc' }, { createdAt: 'asc' }],
    });
  }

  async findById(id: string): Promise<ApiKey | null> {
    return this.prisma.apiKey.findUnique({ where: { id } });
  }

  async create(
    data: { kind: string; label: string | null; key: string; keyHint: string } & Partial<ApiKeyUsage>,
  ): Promise<ApiKey> {
    // A nova vai para o fim da fila
    const last = await this.prisma.apiKey.findFirst({
      where: { kind: data.kind },
      orderBy: { position: 'desc' },
      select: { position: true },
    });
    return this.prisma.apiKey.create({ data: { ...data, position: (last?.position ?? -1) + 1 } });
  }

  async update(
    id: string,
    data: Partial<Pick<ApiKey, 'label' | 'active' | 'position' | 'lastUsedAt' | 'lastError'>> & Partial<ApiKeyUsage>,
  ): Promise<ApiKey> {
    return this.prisma.apiKey.update({ where: { id }, data });
  }

  async delete(id: string): Promise<void> {
    await this.prisma.apiKey.delete({ where: { id } });
  }

  async reorder(kind: string, ids: string[]): Promise<void> {
    const all = await this.prisma.apiKey.findMany({
      where: { kind },
      orderBy: [{ position: 'asc' }, { createdAt: 'asc' }],
      select: { id: true },
    });
    const order = [...ids.filter((id) => all.some((row) => row.id === id)), ...all.map((row) => row.id).filter((id) => !ids.includes(id))];
    await this.prisma.$transaction(
      order.map((id, position) => this.prisma.apiKey.update({ where: { id }, data: { position } })),
    );
  }
}

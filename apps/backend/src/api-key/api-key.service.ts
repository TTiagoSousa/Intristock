import { Injectable, NotFoundException } from '@nestjs/common';
import { PrismaApiKeyRepository } from './repositories/prisma/prisma-api-key-repository';
import { CreateApiKeyDto, ReorderApiKeysDto, UpdateApiKeyDto } from './dto/api-key.dto';
import { API_KEY_PROVIDERS, ApiKeyKind } from './helpers/apiKeyProviders';
import { addApiKey } from './helpers/addApiKey';
import { refreshApiKey } from './helpers/refreshApiKey';
import { runWithApiKey } from './helpers/runWithApiKey';

/**
 * As APIs com várias chaves (por agora a SerpApi, para os preços das motas): gerir as chaves
 * (só o admin) e correr um pedido com a primeira que ainda tem pesquisas (os outros módulos).
 */
@Injectable()
export class ApiKeyService {
  constructor(private readonly repository: PrismaApiKeyRepository) {}

  async list(kind: ApiKeyKind) {
    const keys = await this.repository.findViews(kind);
    const { label, docsUrl } = API_KEY_PROVIDERS[kind];
    return { kind, provider: { label, docsUrl }, keys };
  }

  add(dto: CreateApiKeyDto) {
    return addApiKey(dto, this.repository);
  }

  async update(id: string, dto: UpdateApiKeyDto) {
    if (!(await this.repository.findById(id))) throw new NotFoundException('Chave não encontrada');
    const { key: _secret, ...view } = await this.repository.update(id, {
      ...(dto.label !== undefined ? { label: dto.label.trim() || null } : {}),
      ...(dto.active !== undefined ? { active: dto.active } : {}),
    });
    return view;
  }

  async remove(id: string) {
    if (!(await this.repository.findById(id))) throw new NotFoundException('Chave não encontrada');
    await this.repository.delete(id);
    return { deleted: true };
  }

  async reorder(dto: ReorderApiKeysDto) {
    await this.repository.reorder(dto.kind, dto.ids);
    return this.list(dto.kind);
  }

  // Pergunta à API pelas pesquisas de cada chave (não gasta pesquisas)
  async refresh(kind: ApiKeyKind) {
    const keys = await this.repository.findViews(kind);
    for (const view of keys) {
      const apiKey = await this.repository.findById(view.id);
      if (apiKey) await refreshApiKey(apiKey, this.repository);
    }
    return this.list(kind);
  }

  /** Se há alguma chave que se possa usar agora (sem pedir nada à API). */
  async available(kind: ApiKeyKind) {
    return (await this.repository.findUsable(kind, new Date())).length > 0;
  }

  run<T>(kind: ApiKeyKind, request: (key: string) => Promise<T>) {
    return runWithApiKey(kind, request, this.repository);
  }
}

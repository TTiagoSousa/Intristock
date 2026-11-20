import { ApiKey } from 'src/generated/prisma/client/client';

/** Uma chave sem o valor (o que vai para o browser). */
export type ApiKeyView = Omit<ApiKey, 'key'>;

export type ApiKeyUsage = {
  monthlyLimit: number | null;
  usedThisMonth: number;
  remaining: number | null;
  checkedAt: Date;
  exhaustedUntil: Date | null;
  lastError: string | null;
};

export interface ApiKeyRepository {
  findViews(kind: string): Promise<ApiKeyView[]>;
  /** As que se podem usar agora, pela ordem: ligadas e não esgotadas. */
  findUsable(kind: string, now: Date): Promise<ApiKey[]>;
  findById(id: string): Promise<ApiKey | null>;
  create(data: { kind: string; label: string | null; key: string; keyHint: string } & Partial<ApiKeyUsage>): Promise<ApiKey>;
  update(
    id: string,
    data: Partial<Pick<ApiKey, 'label' | 'active' | 'position' | 'lastUsedAt' | 'lastError'>> & Partial<ApiKeyUsage>,
  ): Promise<ApiKey>;
  delete(id: string): Promise<void>;
  /** Põe as chaves de um tipo pela ordem dada (as outras ficam no fim). */
  reorder(kind: string, ids: string[]): Promise<void>;
}

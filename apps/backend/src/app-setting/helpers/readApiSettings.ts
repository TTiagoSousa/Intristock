import { decryptSecret, secretContext } from 'src/utils/crypto/secret-box';
import { PrismaAppSettingRepository } from '../repositories/prisma/prisma-app-setting-repository';
import { ApiKind, settingKey } from './apiProviders';

export interface StoredApiSetting {
  provider: string | null;
  url: string | null;
  key: string | null;
}

/** O que está guardado para uma API, com a chave já decifrada. */
export async function readApiSettings(
  kind: ApiKind,
  repository: PrismaAppSettingRepository,
): Promise<StoredApiSetting> {
  const rows = await repository.findMany([
    settingKey(kind, 'provider'),
    settingKey(kind, 'url'),
    settingKey(kind, 'key'),
  ]);
  const value = (field: 'provider' | 'url' | 'key') => {
    const row = rows.find((r) => r.key === settingKey(kind, field));
    if (!row) return null;
    return row.encrypted ? decryptSecret(row.value, secretContext('app_setting', row.key, 'value')) : row.value;
  };

  return { provider: value('provider'), url: value('url'), key: value('key') };
}

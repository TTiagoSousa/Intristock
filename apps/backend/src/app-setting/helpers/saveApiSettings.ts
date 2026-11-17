import { BadRequestException } from '@nestjs/common';
import { encryptSecret } from 'src/utils/crypto/secret-box';
import { PrismaAppSettingRepository } from '../repositories/prisma/prisma-app-setting-repository';
import { SaveApiSettingsDto } from '../dto/save-api-settings.dto';
import { API_LABEL, ApiKind, needsKey, settingKey } from './apiProviders';
import { readApiSettings } from './readApiSettings';
import { getApiSettings } from './getApiSettings';

/**
 * Grava as APIs que vierem (o assistente da instalação só manda as duas
 * primeiras). A chave é opcional quando já havia uma: o formulário nunca a
 * recebe de volta, por isso em branco quer dizer que fica a mesma; as APIs
 * públicas não a pedem.
 */
export async function saveApiSettings(dto: SaveApiSettingsDto, repository: PrismaAppSettingRepository) {
  const entries: { key: string; value: string; encrypted: boolean }[] = [];

  for (const kind of ['currency', 'country', 'propfirm', 'exchange'] as ApiKind[]) {
    const input = dto[kind];
    if (!input) continue;
    const newKey = input.key?.trim();

    if (!newKey && needsKey(kind, input.provider)) {
      const stored = await readApiSettings(kind, repository);
      if (!stored.key) {
        throw new BadRequestException(`Falta a chave da API ${API_LABEL[kind]}`);
      }
    }

    entries.push(
      { key: settingKey(kind, 'provider'), value: input.provider, encrypted: false },
      { key: settingKey(kind, 'url'), value: input.url.trim().replace(/\/+$/, ''), encrypted: false },
    );
    if (newKey) {
      entries.push({ key: settingKey(kind, 'key'), value: encryptSecret(newKey), encrypted: true });
    }
  }

  await repository.upsertMany(entries);
  return getApiSettings(repository);
}

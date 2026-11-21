import { BadRequestException } from '@nestjs/common';
import { encryptSecret, secretContext } from 'src/utils/crypto/secret-box';
import { PrismaAppSettingRepository } from '../repositories/prisma/prisma-app-setting-repository';
import { SaveApiSettingsDto } from '../dto/save-api-settings.dto';
import { API_LABEL, ApiKind, needsKey, settingKey } from './apiProviders';
import { readApiSettings } from './readApiSettings';
import { getApiSettings } from './getApiSettings';

// O host de um endereço (sem ele, o texto todo), para ver se a chave mudaria de servidor
function hostOf(url: string | null): string | null {
  if (!url) return null;
  try {
    return new URL(url).host.toLowerCase();
  } catch {
    return url.trim().toLowerCase();
  }
}

/**
 * Grava as APIs que vierem (o assistente da instalação só manda as duas
 * primeiras). A chave é opcional quando já havia uma: o formulário nunca a
 * recebe de volta, por isso em branco quer dizer que fica a mesma; as APIs
 * públicas não a pedem.
 */
export async function saveApiSettings(dto: SaveApiSettingsDto, repository: PrismaAppSettingRepository) {
  const entries: { key: string; value: string; encrypted: boolean }[] = [];
  const dropKeys: string[] = [];

  for (const kind of ['currency', 'country', 'propfirm', 'exchange'] as ApiKind[]) {
    const input = dto[kind];
    if (!input) continue;
    const newKey = input.key?.trim();
    const url = input.url.trim().replace(/\/+$/, '');

    if (!newKey) {
      const stored = await readApiSettings(kind, repository);
      // A chave guardada não segue para outro servidor: mudar o fornecedor ou o host do
      // endereço pede-a outra vez
      const moved =
        Boolean(stored.key) && (stored.provider !== input.provider || hostOf(stored.url) !== hostOf(url));
      if (needsKey(kind, input.provider)) {
        if (!stored.key) throw new BadRequestException(`Falta a chave da API ${API_LABEL[kind]}`);
        if (moved) {
          throw new BadRequestException(`Mudaste o endereço da API ${API_LABEL[kind]}: escreve a chave outra vez`);
        }
      } else if (moved) {
        // Numa API em que a chave é opcional, a antiga sai em vez de ir para o host novo
        dropKeys.push(settingKey(kind, 'key'));
      }
    }

    entries.push(
      { key: settingKey(kind, 'provider'), value: input.provider, encrypted: false },
      { key: settingKey(kind, 'url'), value: url, encrypted: false },
    );
    if (newKey) {
      entries.push({ key: settingKey(kind, 'key'), value: encryptSecret(newKey, secretContext('app_setting', settingKey(kind, 'key'), 'value')), encrypted: true });
    }
  }

  await repository.upsertMany(entries);
  if (dropKeys.length) await repository.deleteMany(dropKeys);
  return getApiSettings(repository);
}

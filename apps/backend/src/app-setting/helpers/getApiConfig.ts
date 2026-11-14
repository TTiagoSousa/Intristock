import { BadRequestException } from '@nestjs/common';
import { PrismaAppSettingRepository } from '../repositories/prisma/prisma-app-setting-repository';
import { API_LABEL, ApiKind, needsKey, PROVIDERS_BY_KIND } from './apiProviders';
import { readApiSettings } from './readApiSettings';

// Em desenvolvimento as chaves podem continuar no .env; na VM vêm da base de dados
const ENV_FALLBACK: Record<ApiKind, { url: string; key: string } | null> = {
  currency: { url: 'Currency_Api', key: 'Currency_Api_Key' },
  country: { url: 'Country_Api', key: 'Country_Api_Key' },
  propfirm: null,
};

/**
 * Endereço e chave com que se chama uma API externa. Primeiro o que o admin
 * guardou na app; sem isso, o .env (desenvolvimento).
 */
export async function getApiConfig(
  kind: ApiKind,
  repository: PrismaAppSettingRepository,
): Promise<{ url: string; key: string }> {
  const stored = await readApiSettings(kind, repository);
  const env = ENV_FALLBACK[kind];
  const keyless = !needsKey(kind, stored.provider);
  // Uma API pública funciona logo com o endereço por omissão, sem nada guardado
  const url =
    stored.url ??
    (env ? process.env[env.url] : undefined) ??
    (keyless ? PROVIDERS_BY_KIND[kind][0].defaultUrl : undefined);
  const key = stored.key ?? (env ? process.env[env.key] : undefined) ?? (keyless ? '' : undefined);

  if (!url || key === undefined || (!keyless && !key)) {
    throw new BadRequestException(
      `A API ${API_LABEL[kind]} ainda não está configurada — o administrador configura-a em Definições → APIs`,
    );
  }

  return { url: url.replace(/\/+$/, ''), key };
}

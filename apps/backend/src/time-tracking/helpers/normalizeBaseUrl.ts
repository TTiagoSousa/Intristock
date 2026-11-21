import { BadRequestException } from '@nestjs/common';

/**
 * O endereço de uma instalação: só http ou https, sem barra nem `/api` no fim
 * («https://solidtime.exemplo.pt/» → «https://solidtime.exemplo.pt»).
 */
export function normalizeBaseUrl(value: string): string {
  let url: URL;
  try {
    url = new URL(value.trim());
  } catch {
    throw new BadRequestException('O endereço não é válido');
  }
  if (url.protocol !== 'https:' && url.protocol !== 'http:')
    throw new BadRequestException('O endereço tem de começar por http:// ou https://');
  if (url.username || url.password) throw new BadRequestException('O endereço não pode levar utilizador nem password');
  const path = url.pathname.replace(/\/+$/, '').replace(/\/api(\/v1)?$/, '');
  return `${url.protocol}//${url.host}${path}`;
}

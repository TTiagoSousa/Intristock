import { BadRequestException } from '@nestjs/common';

const HOUR_MS = 60 * 60 * 1000;
// Os fusos vão de UTC−12 a UTC+14: a hora no fuso de quem escreve cai sempre perto do dia dele
const ZONE_SLACK_MS = 14 * HOUR_MS;

/**
 * O instante de uma transação escrita à mão (a hora que a pessoa pôs, já em UTC pelo browser), como o
 * `externalAt` das da corretora: ordena as do mesmo dia e entra nos gráficos de hora a hora. Sem hora, nulo
 * (a transação fica só com o dia). A hora tem de cair nesse dia, no fuso de alguém.
 */
export function transactionInstant(date: string, at: string | null | undefined): Date | null {
  if (!at) return null;
  const instant = new Date(at);
  if (Number.isNaN(instant.getTime())) throw new BadRequestException('A hora da transação não é válida');
  const dayStart = new Date(`${date.slice(0, 10)}T00:00:00.000Z`).getTime();
  const time = instant.getTime();
  if (time < dayStart - ZONE_SLACK_MS || time >= dayStart + 24 * HOUR_MS + ZONE_SLACK_MS) {
    throw new BadRequestException('A hora não bate com o dia da transação');
  }
  return instant;
}

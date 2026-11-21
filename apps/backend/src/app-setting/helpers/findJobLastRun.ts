import { PrismaAppSettingRepository } from '../repositories/prisma/prisma-app-setting-repository';

// A chave de cada tarefa agendada (sem cifra): `jobs.<nome>.lastRunAt`
export const jobLastRunKey = (job: string) => `jobs.${job}.lastRunAt`;

/** Quando correu pela última vez uma tarefa agendada (nulo se nunca correu). */
export async function findJobLastRun(job: string, repository: PrismaAppSettingRepository) {
  const [row] = await repository.findMany([jobLastRunKey(job)]);
  const at = row ? new Date(row.value) : null;
  return at && !Number.isNaN(at.getTime()) ? at : null;
}

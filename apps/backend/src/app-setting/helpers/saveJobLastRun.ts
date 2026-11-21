import { PrismaAppSettingRepository } from '../repositories/prisma/prisma-app-setting-repository';
import { jobLastRunKey } from './findJobLastRun';

/** Guarda quando uma tarefa agendada acabou de correr (para o arranque seguinte saber). */
export async function saveJobLastRun(job: string, at: Date, repository: PrismaAppSettingRepository) {
  await repository.upsertMany([{ key: jobLastRunKey(job), value: at.toISOString(), encrypted: false }]);
}

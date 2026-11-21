import { Logger } from '@nestjs/common';

/** Onde fica quando cada tarefa correu (o `AppSettingService`). */
export interface JobRunStore {
  jobLastRunAt(job: string): Promise<Date | null>;
  markJobRun(job: string, at?: Date): Promise<void>;
}

export interface ScheduledJobOptions {
  /** O nome da tarefa (a chave no AppSetting). */
  name: string;
  /** De quanto em quanto tempo corre. */
  everyMs: number;
  /**
   * O mínimo depois do arranque antes da primeira volta: cada tarefa tem o seu, para
   * não irem todas às APIs ao mesmo tempo.
   */
  staggerMs: number;
  store: JobRunStore;
  run: () => Promise<unknown>;
  logger?: Logger;
}

/**
 * Uma tarefa que corre de `everyMs` em `everyMs` e que se lembra (no AppSetting) de quando
 * correu: no arranque só corre se já passou o intervalo desde a última vez (cada deploy
 * reinicia o backend, e antes cada um provocava uma rajada de pedidos às APIs), e nunca
 * antes do `staggerMs`. Uma volta que falhe também conta (tenta-se no intervalo seguinte).
 * Devolve a função que a para.
 */
export function startScheduledJob(options: ScheduledJobOptions): () => void {
  const { name, everyMs, staggerMs, store, run, logger } = options;
  let timer: NodeJS.Timeout | null = null;
  let stopped = false;

  const schedule = (delayMs: number) => {
    if (stopped) return;
    timer = setTimeout(() => void tick(), Math.max(0, delayMs));
    timer.unref();
  };

  const tick = async () => {
    try {
      await run();
    } catch (error) {
      logger?.warn(`Tarefa ${name}: ${(error as Error).message}`);
    }
    await store.markJobRun(name).catch((error: Error) => logger?.warn(`Tarefa ${name} por registar: ${error.message}`));
    schedule(everyMs);
  };

  void store
    .jobLastRunAt(name)
    .catch(() => null)
    .then((lastRunAt) => {
      // Nunca mais do que um intervalo (um relógio que andou para trás)
      const dueIn = lastRunAt ? Math.min(everyMs, lastRunAt.getTime() + everyMs - Date.now()) : 0;
      schedule(Math.max(staggerMs, dueIn));
    });

  return () => {
    stopped = true;
    if (timer) clearTimeout(timer);
  };
}

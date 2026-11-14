import type { TFunction } from 'i18next';
import type { Run_Progress_Info, Run_Status } from '../../../../Hooks/Trading/useSimulation';

// As fases por que uma simulação passa, pela ordem: as velas (o downloader),
// a fila (à espera de um processo), a simulação, o relatório e a gravação
export const RUN_STAGES = ['candles', 'queue', 'simulation', 'report', 'saving'] as const;
export type Run_Stage = (typeof RUN_STAGES)[number];

// O que a lista e a página da simulação têm de uma simulação
export interface Run_Progress_Source {
  status: Run_Status;
  progress: number;
  progressInfo: Run_Progress_Info | null;
  startedAt: string | null;
  download: {
    status: Run_Status;
    monthsDone: number;
    monthsTotal: number;
    currentMonth: string | null;
    startedAt?: string | null;
  };
}

/** A fase em que a simulação vai (nula se acabou, falhou ou foi cancelada). */
export const runStage = (run: Run_Progress_Source): Run_Stage | null => {
  if (run.status === 'queued') return run.download.status === 'done' ? 'queue' : 'candles';
  // A cancelar ainda corre (o simulador para-a dentro de poucos segundos)
  if (run.status !== 'running' && run.status !== 'cancelling') return null;
  const phase = run.progressInfo?.phase;
  if (phase === 'report') return 'report';
  if (phase === 'saving') return 'saving';
  return 'simulation';
};

/**
 * A percentagem da fase em curso (as velas: os meses; daí para a frente, a
 * barra do simulador) e a hora prevista do fim, em ms: nas velas pelo ritmo
 * dos meses já feitos, na simulação a que o simulador grava. Nula enquanto não
 * há por onde a prever.
 */
export const runProgressOf = (run: Run_Progress_Source, now: number) => {
  const stage = runStage(run);
  if (stage === 'candles') {
    const { monthsDone, monthsTotal, startedAt } = run.download;
    const percent = monthsTotal > 0 ? Math.round((monthsDone / monthsTotal) * 100) : 0;
    const started = startedAt ? new Date(startedAt).getTime() : null;
    const endAt =
      started && monthsDone > 0 ? now + ((now - started) / monthsDone) * (monthsTotal - monthsDone) : null;
    return { stage, percent, endAt };
  }
  if (stage === 'queue') return { stage, percent: 0, endAt: null };
  if (stage === null) return { stage, percent: run.status === 'done' ? 100 : 0, endAt: null };
  return { stage, percent: run.progress, endAt: run.progressInfo?.estimatedEndAt ?? null };
};

/** Um intervalo de tempo curto e legível: "45 s", "12 min", "1 h 05 min". */
export const formatDuration = (ms: number, t: TFunction) => {
  const seconds = Math.max(0, Math.round(ms / 1000));
  if (seconds < 60) return t('trading.durationSeconds', { count: seconds });
  const minutes = Math.round(seconds / 60);
  if (minutes < 60) return t('trading.durationMinutes', { count: minutes });
  return t('trading.durationHours', { hours: Math.floor(minutes / 60), minutes: String(minutes % 60).padStart(2, '0') });
};

export const formatClock = (ms: number, language: string) =>
  new Date(ms).toLocaleTimeString(language, { hour: '2-digit', minute: '2-digit' });

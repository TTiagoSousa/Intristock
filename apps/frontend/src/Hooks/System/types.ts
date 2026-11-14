export interface ReleaseNotes {
  features: string[];
  fixes: string[];
  improvements: string[];
  other: string[];
}

export interface Release {
  version: string;
  date: string;
  title: string | null;
  notes: ReleaseNotes;
}

export interface ListedRelease extends Release {
  installed: boolean;
  newer: boolean;
  // A única que se pode instalar: atualiza-se uma versão de cada vez
  next: boolean;
}

export interface InstalledVersion {
  version: string | null;
  baseVersion: string | null;
  commit: string;
  date: string | null;
  branch: string | null;
}

export type UpdateState = 'idle' | 'queued' | 'running' | 'success' | 'failed';

export interface UpdateStatus {
  state: UpdateState;
  target: string | null;
  from: string | null;
  step: string | null;
  message: string | null;
  startedAt: string | null;
  finishedAt: string | null;
  log: string[];
}

export interface VersionOverview {
  updatesEnabled: boolean;
  installed: InstalledVersion;
  latest: Release | null;
  next: Release | null;
  updateAvailable: boolean;
  newerCount: number;
  offline: boolean;
  update: UpdateStatus;
}

export interface ReleaseList {
  updatesEnabled: boolean;
  installed: InstalledVersion;
  offline: boolean;
  releases: ListedRelease[];
}

export const installedLabel = (installed: InstalledVersion | undefined) => {
  if (!installed) return '—';
  if (installed.version) return installed.version;
  const base = installed.baseVersion ? `${installed.baseVersion}+` : '';
  return `${base}${installed.branch ?? 'dev'}${installed.commit ? ` (${installed.commit})` : ''}`;
};

// Uma versão na página das novidades (todos os utilizadores)
export interface PublicRelease extends Release {
  // A que está em uso (a instalada, ou a release em que o código assenta)
  current: boolean;
  newer: boolean;
  next: boolean;
}

export interface PublicReleaseList {
  current: string | null;
  // Falso em desenvolvimento ou num branch: o código vai além da `current`
  exact: boolean;
  offline: boolean;
  releases: PublicRelease[];
}

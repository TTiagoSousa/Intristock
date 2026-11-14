import { NoteLanguage } from './getReleases';
import { listReleases } from './getVersionOverview';

/**
 * As versões para a página das novidades (todos os utilizadores): a lista com as
 * notas e a que está em uso — a instalada ou, em desenvolvimento, a release em que
 * o código assenta (`current`). Sem o estado das atualizações, que é do admin.
 */
export async function getPublicReleases(language: NoteLanguage) {
  const { installed, offline, releases } = await listReleases(false, language);
  const current = installed.version ?? installed.baseVersion;
  return {
    current,
    exact: installed.version !== null,
    offline,
    releases: releases.map((release) => ({
      version: release.version,
      date: release.date,
      title: release.title,
      notes: release.notes,
      current: release.version === current,
      newer: release.newer,
      next: release.next,
    })),
  };
}

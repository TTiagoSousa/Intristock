import { getInstalledVersion, InstalledVersion } from './getInstalledVersion';
import { getReleases, NoteLanguage, Release } from './getReleases';
import { compareVersions } from './semver';
import { readUpdateStatus, updatesDir } from './updateFiles';

/**
 * A versão que se pode instalar a seguir: a primeira release mais recente do que
 * a instalada. Atualiza-se **uma versão de cada vez** — cada uma pode trazer
 * passos próprios (migrações, programas novos na VM) que contam com a anterior.
 */
export function nextRelease(installed: InstalledVersion, releases: Release[]): Release | null {
  const reference = installed.version ?? installed.baseVersion;
  const newer = releases
    .filter((r) => !reference || compareVersions(r.version, reference) > 0)
    .sort((a, b) => compareVersions(a.version, b.version));
  return newer[0] ?? null;
}

/**
 * Para o cartão da secção Versões: o que está instalado, a próxima versão (com as
 * notas na língua pedida), a última que existe e o estado de uma atualização em
 * curso.
 */
export async function getVersionOverview(language: NoteLanguage) {
  const [installed, { releases, offline }, update] = await Promise.all([
    getInstalledVersion(),
    getReleases(false, language),
    readUpdateStatus(0),
  ]);

  const reference = installed.version ?? installed.baseVersion;
  const newerCount = releases.filter((r) => !reference || compareVersions(r.version, reference) > 0).length;

  return {
    updatesEnabled: Boolean(updatesDir()),
    installed,
    latest: releases[0] ?? null,
    next: nextRelease(installed, releases),
    updateAvailable: newerCount > 0,
    newerCount,
    offline,
    update,
  };
}

/** A lista completa, com cada release marcada como instalada, mais recente ou a próxima. */
export async function listReleases(force: boolean, language: NoteLanguage) {
  const [installed, { releases, offline }] = await Promise.all([
    getInstalledVersion(),
    getReleases(force, language),
  ]);
  const reference = installed.version ?? installed.baseVersion;
  const next = nextRelease(installed, releases);

  return {
    updatesEnabled: Boolean(updatesDir()),
    installed,
    offline,
    releases: releases.map((release) => ({
      ...release,
      installed: release.version === installed.version,
      newer: !reference || compareVersions(release.version, reference) > 0,
      next: release.version === next?.version,
    })),
  };
}

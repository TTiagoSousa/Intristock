import { NotificationService } from 'src/notification/notification.service';
import { PrismaSystemRepository } from '../repositories/prisma/prisma-system-repository';
import { getInstalledVersion } from './getInstalledVersion';
import { getReleases } from './getReleases';
import { nextRelease } from './getVersionOverview';

export const ANNOUNCED_VERSION_KEY = 'system.announcedVersion';

/**
 * De tanto em tanto tempo: se há uma versão para instalar a seguir que ainda não
 * foi anunciada, avisa os administradores (cada versão uma vez só).
 */
export async function checkNewRelease(
  repository: PrismaSystemRepository,
  notifications: NotificationService,
) {
  const [installed, { releases }] = await Promise.all([
    getInstalledVersion(),
    getReleases(false, 'en'),
  ]);
  const next = nextRelease(installed, releases);
  if (!next) return null;
  const announced = await repository.readSetting(ANNOUNCED_VERSION_KEY);
  if (announced === next.version) return null;
  await repository.writeSetting(ANNOUNCED_VERSION_KEY, next.version);
  await notifications.notify({
    kind: 'version_available',
    data: {
      version: next.version,
      installed: installed.version ?? installed.baseVersion,
    },
    link: `/Versoes?v=${next.version}`,
    adminsOnly: true,
  });
  return next.version;
}

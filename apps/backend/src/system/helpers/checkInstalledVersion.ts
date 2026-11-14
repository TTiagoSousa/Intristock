import { NotificationService } from 'src/notification/notification.service';
import { PrismaSystemRepository } from '../repositories/prisma/prisma-system-repository';
import { getInstalledVersion } from './getInstalledVersion';

export const INSTALLED_VERSION_KEY = 'system.installedVersion';

/**
 * No arranque: se a versão instalada não é a da última vez (uma atualização, ou a
 * primeira vez que esta versão corre), avisa todos os utilizadores para verem as
 * novidades. Em desenvolvimento conta a release em que o código assenta.
 */
export async function checkInstalledVersion(
  repository: PrismaSystemRepository,
  notifications: NotificationService,
) {
  const installed = await getInstalledVersion();
  const current = installed.version ?? installed.baseVersion;
  if (!current) return null;
  const previous = await repository.readSetting(INSTALLED_VERSION_KEY);
  if (previous === current) return null;
  await repository.writeSetting(INSTALLED_VERSION_KEY, current);
  await notifications.notify({
    kind: 'version_installed',
    data: { version: current, previous },
    link: `/Versoes?v=${current}`,
    adminsOnly: false,
  });
  return current;
}

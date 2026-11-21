import { readFile } from 'fs/promises';
import { NotificationService } from 'src/notification/notification.service';
import { PrismaSystemRepository } from '../repositories/prisma/prisma-system-repository';

export const ANNOUNCED_BACKUP_FAILURE_KEY = 'system.announcedBackupFailure';

// O que o deploy/proxmox/backup.sh escreve no fim de cada backup (do root, a app só lê)
const DEFAULT_BACKUP_STATUS_FILE = '/var/lib/intristock-state/backup.json';

interface BackupStatus {
  state?: string;
  label?: string;
  message?: string;
  at?: string;
}

export function backupStatusFile(): string {
  return process.env.BACKUP_STATUS_FILE || DEFAULT_BACKUP_STATUS_FILE;
}

/**
 * Se o último backup falhou e essa falha ainda não foi anunciada, avisa os
 * administradores (cada falha uma vez só, pela hora dela). Sem ficheiro (em
 * desenvolvimento, ou ainda sem nenhum backup) não faz nada. Devolve a hora da falha
 * anunciada, ou nulo.
 */
export async function checkBackupStatus(
  repository: PrismaSystemRepository,
  notifications: NotificationService,
): Promise<string | null> {
  let status: BackupStatus;
  try {
    status = JSON.parse(await readFile(backupStatusFile(), 'utf8')) as BackupStatus;
  } catch {
    return null;
  }
  if (status.state !== 'failed' || !status.at) return null;
  const at = new Date(status.at);
  if (Number.isNaN(at.getTime())) return null;

  const announced = await repository.readSetting(ANNOUNCED_BACKUP_FAILURE_KEY);
  if (announced && new Date(announced).getTime() >= at.getTime()) return null;

  await repository.writeSetting(ANNOUNCED_BACKUP_FAILURE_KEY, at.toISOString());
  await notifications.notify({
    kind: 'backup_failed',
    data: {
      at: at.toISOString(),
      label: status.label ?? null,
      message: status.message ?? null,
    },
    link: null,
    adminsOnly: true,
  });
  return at.toISOString();
}

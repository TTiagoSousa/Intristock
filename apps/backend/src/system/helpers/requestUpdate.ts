import { BadRequestException, ConflictException, ServiceUnavailableException } from '@nestjs/common';
import { getInstalledVersion } from './getInstalledVersion';
import { getReleases } from './getReleases';
import { nextRelease } from './getVersionOverview';
import { readUpdateStatus, updatesDir, writeUpdateRequest } from './updateFiles';

/**
 * Pede a atualização para uma release. Só para a frente e **só para a seguinte**:
 * voltar atrás não desfaz as migrações da base de dados, e saltar versões passava
 * por cima dos passos que cada uma traz para a VM.
 */
export async function requestUpdate(version: string) {
  if (!updatesDir()) {
    throw new ServiceUnavailableException('As atualizações só funcionam na instalação da VM.');
  }

  const status = await readUpdateStatus(0);
  if (status.state === 'queued' || status.state === 'running') {
    throw new ConflictException('Já há uma atualização em curso.');
  }

  const { releases } = await getReleases(true);
  if (!releases.some((r) => r.version === version)) {
    throw new BadRequestException(`A versão ${version} não existe.`);
  }

  const installed = await getInstalledVersion();
  const next = nextRelease(installed, releases);
  if (!next) {
    throw new BadRequestException('Já estás na versão mais recente.');
  }
  if (next.version !== version) {
    throw new BadRequestException(
      `Atualiza-se uma versão de cada vez: a seguir à instalada vem a ${next.version}.`,
    );
  }

  await writeUpdateRequest(version);
  return readUpdateStatus(0);
}

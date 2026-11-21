import { decryptSecret, secretContext } from 'src/utils/crypto/secret-box';
import { PrismaTimeTrackingRepository } from '../repositories/prisma/prisma-time-tracking-repository';
import {
  fetchSolidtimeClients,
  fetchSolidtimeMembers,
  fetchSolidtimeOrganization,
  fetchSolidtimeProjects,
  fetchSolidtimeTimeEntries,
  fetchSolidtimeUser,
} from './solidtimeClient';

// Os registos editam-se na app: cada volta lê outra vez os destes últimos dias
export const RESYNC_DAYS = 60;

// Os preços vêm em cêntimos
const fromCents = (value: number | null | undefined) =>
  value === null || value === undefined ? null : Math.round(value) / 100;

/**
 * Uma volta de uma ligação ao solidtime: os clientes, os projetos e as pessoas (os membros da
 * organização, pelo id do utilizador, que é o dos registos), depois os registos — todos na
 * primeira vez, a seguir os dos últimos `RESYNC_DAYS` dias. Os registos a decorrer (sem fim)
 * ficam para quando acabarem. Só se escrevem os novos e os que mudaram. Os que desapareceram da
 * app nesse intervalo saem, menos os que já têm horas pagas (ao cliente ou à pessoa), e só se a
 * lista veio completa. O que não bate certo com o que está pago (um registo pago que mudou de
 * cliente ou de pessoa, que encolheu ou que foi apagado na app) fica no `lastError`, em aviso.
 *
 * Na primeira vez, a pessoa da chave fica ligada a quem criou a ligação: ao membro dele, ou só
 * à conta, se for o dono da empresa (que não é membro).
 */
export async function syncSolidtime(connectionId: string, repository: PrismaTimeTrackingRepository) {
  const connection = await repository.findConnection(connectionId);
  if (!connection) return { entries: 0, removed: 0 };
  const credentials = { baseUrl: connection.baseUrl, token: decryptSecret(connection.apiToken, secretContext('time_tracking_connection', connection.companyId, 'apiToken')) };
  const organizationId = connection.organizationId;

  const [organization, me, clients, projects, members] = await Promise.all([
    fetchSolidtimeOrganization(credentials, organizationId),
    fetchSolidtimeUser(credentials),
    fetchSolidtimeClients(credentials, organizationId),
    fetchSolidtimeProjects(credentials, organizationId),
    fetchSolidtimeMembers(credentials, organizationId),
  ]);

  const clientIds = await repository.upsertClients(
    connectionId,
    clients.map((client) => ({ externalId: client.id, name: client.name, isArchived: client.is_archived })),
  );
  const projectRows = await repository.upsertProjects(
    connectionId,
    projects.map((project) => ({
      externalId: project.id,
      clientExternalId: project.client_id,
      name: project.name,
      color: project.color,
      billableRate: fromCents(project.billable_rate),
      isBillable: project.is_billable,
      isArchived: project.is_archived,
    })),
    clientIds,
  );
  // O preço do membro, ou o da organização: o último antes de não haver nenhum
  const organizationRate = fromCents(organization.billable_rate);
  const personIds = await repository.upsertPeople(
    connectionId,
    members.map((member) => ({
      externalId: member.user_id,
      name: member.name,
      billableRate: fromCents(member.billable_rate) ?? organizationRate,
    })),
  );

  if (!connection.syncedAt) {
    const member = await repository.findMemberOfUser(connection.companyId, connection.createdById);
    const owner = await repository.findCompanyOwner(connection.companyId);
    // Um membro fica ligado ao membro; o dono (que não é membro) só à conta dele
    if (member) await repository.linkPerson(connectionId, me.id, { memberId: member.id, userId: connection.createdById });
    else if (owner?.createdBy.id === connection.createdById)
      await repository.linkPerson(connectionId, me.id, { memberId: null, userId: connection.createdById });
  }

  const since = connection.syncedAt ? new Date(Date.now() - RESYNC_DAYS * 24 * 60 * 60 * 1000) : null;
  const listing = await fetchSolidtimeTimeEntries(credentials, organizationId, since);
  const entries = listing.entries.filter((entry) => entry.end !== null);
  const projectById = new Map(projectRows.map((project) => [project.externalId, project]));

  const written = await repository.syncEntries(
    connectionId,
    entries.map((entry) => {
      const project = entry.project_id ? projectById.get(entry.project_id) : undefined;
      const start = new Date(entry.start);
      const end = entry.end ? new Date(entry.end) : null;
      const seconds =
        entry.duration ?? (end ? Math.max(0, Math.round((end.getTime() - start.getTime()) / 1000)) : 0);
      return {
        externalId: entry.id,
        projectId: project?.id ?? null,
        clientId: project?.clientId ?? null,
        personId: personIds.get(entry.user_id) ?? null,
        start,
        end,
        seconds,
        description: entry.description?.trim() || null,
        billable: entry.billable,
      };
    }),
  );
  // Sem a lista toda não se sabe o que saiu da app: não se apaga nada nesta volta. Os a decorrer
  // contam como presentes (não se apaga um registo só por estar outra vez a correr).
  const missing = listing.complete
    ? await repository.deleteMissingEntries(
        connectionId,
        since,
        listing.entries.map((entry) => entry.id),
      )
    : { removed: 0, keptPaid: 0 };

  const warnings: string[] = [];
  if (!listing.complete)
    warnings.push('A lista de registos do solidtime não veio completa: nesta volta não se apagou nenhum registo');
  if (written.moved)
    warnings.push(
      `${written.moved} registo(s) já pago(s) mudaram de cliente ou de pessoa no solidtime: ficaram aqui com os de antes`,
    );
  if (written.shrunk)
    warnings.push(`${written.shrunk} registo(s) já pago(s) têm agora menos horas no solidtime do que as pagas`);
  if (missing.keptPaid)
    warnings.push(`${missing.keptPaid} registo(s) já pago(s) foram apagados no solidtime: ficaram aqui`);

  await repository.updateConnection(connectionId, {
    organizationName: organization.name,
    status: connection.status === 'paused' ? 'paused' : 'active',
    lastError: warnings.length ? `Avisos: ${warnings.join('; ')}.` : null,
    syncedAt: new Date(),
  });
  return { entries: entries.length, removed: missing.removed };
}

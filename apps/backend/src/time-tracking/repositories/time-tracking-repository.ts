/** O que a sincronização grava de cada coisa que vem da app de horas. */
export type ClientRow = { externalId: string; name: string; isArchived: boolean };

export type ProjectRow = {
  externalId: string;
  clientExternalId: string | null;
  name: string;
  color: string | null;
  billableRate: number | null;
  isBillable: boolean;
  isArchived: boolean;
};

export type PersonRow = { externalId: string; name: string; billableRate: number | null };

export type EntryRow = {
  externalId: string;
  projectExternalId: string | null;
  personExternalId: string;
  start: Date;
  end: Date | null;
  seconds: number;
  description: string | null;
  billable: boolean;
};

/** Um registo como a sincronização o grava (com os ids daqui). */
export type SyncedEntry = Omit<EntryRow, 'projectExternalId' | 'personExternalId'> & {
  projectId: string | null;
  clientId: string | null;
  personId: string | null;
};

/** Um registo como está gravado, com o que já está pago dele (pelo cliente e à pessoa). */
export type StoredEntry = SyncedEntry & { id: string; paidSeconds: number; payoutSeconds: number };

/**
 * Um registo como as contas o leem: o preço vem do cliente, do projeto ou da pessoa (que já
 * traz o da organização), e o que está pago das alocações.
 */
export type RatedEntry = {
  id: string;
  connectionId: string;
  start: Date;
  end: Date | null;
  seconds: number;
  description: string | null;
  billable: boolean;
  clientId: string | null;
  personId: string | null;
  client: { id: string; name: string; hourlyRate: number | null; billing: string; withholdingPct: number | null } | null;
  project: { id: string; name: string; color: string | null; billableRate: number | null; isBillable: boolean } | null;
  person: {
    id: string;
    name: string;
    billableRate: number | null;
    memberId: string | null;
    userId: string | null;
    // O que a empresa lhe paga por hora (nulo = o valor das horas) e a retenção disso
    payRate: number | null;
    payWithholdingPct: number | null;
  } | null;
  // Pago pelo cliente à empresa (liquidações)
  paidSeconds: number;
  // Pago pela empresa a quem fez as horas
  payoutSeconds: number;
};

export type EntryFilter = {
  companyId: string;
  from?: Date;
  // Exclusivo
  to?: Date;
  connectionId?: string;
  clientId?: string;
  personId?: string;
};

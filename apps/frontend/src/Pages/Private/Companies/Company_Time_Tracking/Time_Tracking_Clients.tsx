import { useEffect, useState } from 'react';
import { useTranslation } from 'react-i18next';
import http from '../../../../Service/httpService';
import { End_Points } from '../../../../Service/endPoints';
import { useAlert } from '../../../../Contexts/Alert_Context';
import { useCompany } from '../../../../Contexts/Company_Context';
import { getErrorMessage } from '../../../../Hooks/useAsyncRequest';
import { useCompanySupplierOptions } from '../../../../Hooks/Companies/useCompanyOptions';
import { useCurrencyFormat } from '../../../../Hooks/useCurrencyFormat';
import {
  formatDuration,
  timeTrackingApi,
  useTimeClients,
  useTimeConnections,
  useTimePeople,
  type Time_Client,
  type Time_Person,
} from '../../../../Hooks/Companies/useTimeTracking';
import Global_Dropdown from '../../../../Components/Inputs/Global_Dropdown/Global_Dropdown';
import Global_Input from '../../../../Components/Inputs/Global_Input/Global_Input';
import Time_Client_Popover, { type Time_Client_Input } from './Time_Client_Popover';
import Time_Tracking_Shell from './Time_Tracking_Shell';

type Member_Option = { id: string; name: string; hasAccount: boolean };

// A quem vão as horas de uma pessoa, no dropdown: ninguém, o dono ou um membro
const NOBODY = '';
// O cliente da empresa: criar um novo com o nome do da app (particular ou empresa)
const CREATE_INDIVIDUAL = '__create_individual';
const CREATE_COMPANY = '__create_company';
const OWNER = '__owner';

const Clients_Body = ({ company }: { company: { id: string } }) => {
  const { t } = useTranslation();
  const { setAlert } = useAlert();
  const { can } = useCompany();
  const { formatMaybeIn } = useCurrencyFormat();
  const canManage = can('timesheet.manage');
  const { data: clients, error, reload } = useTimeClients(company.id);
  const { data: people, reload: reloadPeople } = useTimePeople(company.id);
  const { data: connections } = useTimeConnections(company.id);
  const { suppliers, refresh: refreshSuppliers } = useCompanySupplierOptions(company.id);
  const [members, setMembers] = useState<Member_Option[]>([]);
  const [editing, setEditing] = useState<Time_Client | null>(null);
  const [saving, setSaving] = useState(false);
  // O que se escolheu para cada pessoa, antes de a resposta chegar (atualização otimista)
  const [chosen, setChosen] = useState<Record<string, string>>({});

  // Os membros da empresa, para ligar as pessoas da app (só quem os pode ver)
  useEffect(() => {
    if (!canManage) return;
    let cancelled = false;
    http
      .get<{ members: { id: string; name: string; user: { id: string } | null }[] }>(End_Points.Company_Members_Endpoint(company.id))
      .then((response) => {
        if (!cancelled)
          setMembers(response.data.members.map((member) => ({ id: member.id, name: member.name, hasAccount: !!member.user })));
      })
      .catch(() => undefined);
    return () => {
      cancelled = true;
    };
  }, [company.id, canManage]);

  const currencyOf = (connectionId: string) =>
    connections?.find((connection) => connection.id === connectionId)?.currency.shortCode ?? '';
  const appRateOf = (client: Time_Client) =>
    client.projects.find((project) => project.billableRate !== null)?.billableRate ?? null;

  const saveClient = async (input: Time_Client_Input) => {
    if (!editing) return;
    setSaving(true);
    try {
      await timeTrackingApi.updateClient(company.id, editing.id, input);
      setAlert({ open: true, message: t('timeTracking.clientSaved'), type: 'success' });
      setEditing(null);
      reload();
      if (input.createSupplier) refreshSuppliers();
    } catch (reason) {
      setAlert({ open: true, message: getErrorMessage(reason), type: 'error' });
    } finally {
      setSaving(false);
    }
  };

  // Ligar o cliente da app a um cliente da empresa logo na tabela (ou criar um, particular ou empresa)
  const [linking, setLinking] = useState<string | null>(null);
  const linkClient = async (client: Time_Client, value: string) => {
    setLinking(client.id);
    try {
      await timeTrackingApi.updateClient(
        company.id,
        client.id,
        value === CREATE_INDIVIDUAL
          ? { createSupplier: 'individual' }
          : value === CREATE_COMPANY
            ? { createSupplier: 'company' }
            : { supplierId: value || null },
      );
      setAlert({ open: true, message: t('timeTracking.clientLinked'), type: 'success' });
      reload();
      if (value === CREATE_INDIVIDUAL || value === CREATE_COMPANY) refreshSuppliers();
    } catch (reason) {
      setAlert({ open: true, message: getErrorMessage(reason), type: 'error' });
    } finally {
      setLinking(null);
    }
  };

  // O que a empresa paga a cada pessoa: grava-se ao sair do campo (vazio = o valor das horas / sem retenção)
  const [payDraft, setPayDraft] = useState<Record<string, { payRate?: string; payWithholdingPct?: string }>>({});
  // Um valor que não se gravou volta ao que está gravado (não fica no campo como se estivesse)
  const dropDraft = (personId: string, field: 'payRate' | 'payWithholdingPct') =>
    setPayDraft((current) => {
      const rest = { ...current[personId] };
      delete rest[field];
      return { ...current, [personId]: rest };
    });
  const savePay = async (person: Time_Person, field: 'payRate' | 'payWithholdingPct') => {
    const text = payDraft[person.id]?.[field];
    if (text === undefined) return;
    const clean = text.trim().replace(',', '.');
    const value = clean ? Number(clean) : null;
    if (value !== null && (!Number.isFinite(value) || value < 0 || (field === 'payWithholdingPct' && value > 100))) {
      setAlert({ open: true, message: t('timeTracking.payInvalid'), type: 'error' });
      dropDraft(person.id, field);
      return;
    }
    if (value === person[field]) return;
    try {
      await timeTrackingApi.updatePerson(company.id, person.id, { [field]: value });
      setAlert({ open: true, message: t('timeTracking.paySaved'), type: 'success' });
      reloadPeople();
    } catch (reason) {
      setAlert({ open: true, message: getErrorMessage(reason), type: 'error' });
      dropDraft(person.id, field);
    }
  };
  const payText = (person: Time_Person, field: 'payRate' | 'payWithholdingPct') =>
    payDraft[person.id]?.[field] ?? (person[field] === null ? '' : String(person[field]));

  const personValue = (person: Time_Person) =>
    chosen[person.id] ?? (person.member ? person.member.id : person.owner ? OWNER : NOBODY);

  const savePerson = async (person: Time_Person, value: string) => {
    setChosen((current) => ({ ...current, [person.id]: value }));
    try {
      await timeTrackingApi.updatePerson(
        company.id,
        person.id,
        value === OWNER ? { owner: true } : { memberId: value || null },
      );
      reloadPeople();
    } catch (reason) {
      setChosen((current) => {
        const next = { ...current };
        delete next[person.id];
        return next;
      });
      setAlert({ open: true, message: getErrorMessage(reason), type: 'error' });
    }
  };

  const billingLabel = (client: Time_Client) =>
    client.billing === 'freelance' && client.withholdingPct !== null
      ? t('timeTracking.billingWithWithholding', { pct: client.withholdingPct })
      : t(`timeTracking.billing_${client.billing}`);

  return (
    <>
      <div className="Page_Head">
        <h1>{t('timeTracking.clientsTitle')}</h1>
      </div>
      {error && <span className="Time_Tracking_Message Bad">{error}</span>}

      <div className="Card Time_Tracking_Card">
        <div className="Card_Header">
          <div className="Card_Header_Text">
            <span className="Card_Title">{t('timeTracking.clientsCardTitle')}</span>
            <span className="Card_Subtitle">{t('timeTracking.clientsCardSubtitle')}</span>
          </div>
        </div>
        <div className="Time_Tracking_Body">
          {!clients ? (
            <span className="Time_Tracking_Message">{t('common.loading')}</span>
          ) : clients.length === 0 ? (
            <span className="Time_Tracking_Message">{t('timeTracking.clientsEmpty')}</span>
          ) : (
            <div className="Table_Wrap">
              <table className="Table">
                <thead>
                  <tr>
                    <th>{t('timeTracking.client')}</th>
                    <th>{t('timeTracking.companyClient')}</th>
                    <th>{t('timeTracking.projects')}</th>
                    <th className="Right">{t('timeTracking.rate')}</th>
                    <th>{t('timeTracking.billing')}</th>
                    <th className="Right">{t('timeTracking.credit')}</th>
                    {canManage && <th />}
                  </tr>
                </thead>
                <tbody>
                  {clients.map((client) => {
                    const code = currencyOf(client.connectionId);
                    const appRate = appRateOf(client);
                    return (
                      <tr key={client.id}>
                        <td>
                          <span className="Time_Tracking_Strong">{client.name}</span>
                          {client.isArchived && <span className="Pill Time_Tracking_Pill">{t('timeTracking.archived')}</span>}
                          {(connections?.length ?? 0) > 1 && <div className="Time_Tracking_Sub">{client.organizationName}</div>}
                        </td>
                        <td className="Time_Tracking_Picker">
                          {canManage ? (
                            <Global_Dropdown
                              id={`time-client-link-${client.id}`}
                              value={client.supplier?.id ?? ''}
                              disabled={linking === client.id}
                              onChange={(value) => void linkClient(client, String(value))}
                              options={[
                                { value: '', label: t('timeTracking.noCompanyClient') },
                                { value: CREATE_INDIVIDUAL, label: t('timeTracking.createIndividual', { name: client.name }) },
                                { value: CREATE_COMPANY, label: t('timeTracking.createCompany', { name: client.name }) },
                                ...suppliers.map((row) => ({ value: row.id, label: row.name, group: t('timeTracking.existingClients') })),
                              ]}
                            />
                          ) : (
                            (client.supplier?.name ?? <span className="Time_Tracking_Sub">{t('timeTracking.noCompanyClient')}</span>)
                          )}
                        </td>
                        <td>
                          {client.projects.length === 0 ? (
                            <span className="Time_Tracking_Sub">—</span>
                          ) : (
                            client.projects.map((project) => (
                              <div key={project.id} className="Time_Tracking_Sub">
                                {project.name}
                                {project.billableRate !== null ? ` · ${formatMaybeIn(project.billableRate, code)}/h` : ''}
                              </div>
                            ))
                          )}
                        </td>
                        <td className="Right Num">
                          {client.hourlyRate !== null ? (
                            `${formatMaybeIn(client.hourlyRate, code)}/h`
                          ) : appRate !== null ? (
                            <span className="Time_Tracking_Sub">{t('timeTracking.fromApp')}</span>
                          ) : (
                            '—'
                          )}
                        </td>
                        <td>{billingLabel(client)}</td>
                        <td className="Right Num">
                          {client.creditSeconds > 0 ? (
                            <>
                              {formatDuration(client.creditSeconds)}
                              <div className="Time_Tracking_Sub">{formatMaybeIn(client.creditAmount, code)}</div>
                            </>
                          ) : (
                            '—'
                          )}
                        </td>
                        {canManage && (
                          <td className="Right">
                            <button type="button" className="Time_Tracking_Action" onClick={() => setEditing(client)}>
                              {t('common.edit')}
                            </button>
                          </td>
                        )}
                      </tr>
                    );
                  })}
                </tbody>
              </table>
            </div>
          )}
        </div>
      </div>

      <div className="Card Time_Tracking_Card">
        <div className="Card_Header">
          <div className="Card_Header_Text">
            <span className="Card_Title">{t('timeTracking.peopleTitle')}</span>
            <span className="Card_Subtitle">{t('timeTracking.peopleSubtitle')}</span>
          </div>
        </div>
        <div className="Time_Tracking_Body">
          {!people ? (
            <span className="Time_Tracking_Message">{t('common.loading')}</span>
          ) : people.length === 0 ? (
            <span className="Time_Tracking_Message">{t('timeTracking.peopleEmpty')}</span>
          ) : (
            <div className="Time_Tracking_People">
              {people.map((person) => (
                <div key={person.id} className="Time_Tracking_Person">
                  <div className="Time_Tracking_List_Text">
                    <span className="Time_Tracking_Strong">{person.name}</span>
                    <span className="Time_Tracking_Sub">{person.organizationName}</span>
                  </div>
                  {canManage && (
                    <div className="Time_Tracking_Person_Pay">
                      <div className="Form_Field">
                        <label htmlFor={`time-person-rate-${person.id}`}>
                          {t('timeTracking.payRate', { currency: currencyOf(person.connectionId) })}
                        </label>
                        <Global_Input
                          id={`time-person-rate-${person.id}`}
                          value={payText(person, 'payRate')}
                          placeholder={t('timeTracking.payRatePlaceholder')}
                          onChange={(event) =>
                            setPayDraft((current) => ({ ...current, [person.id]: { ...current[person.id], payRate: event.target.value } }))
                          }
                          onBlur={() => void savePay(person, 'payRate')}
                        />
                      </div>
                      <div className="Form_Field">
                        <label htmlFor={`time-person-withholding-${person.id}`}>{t('timeTracking.payWithholding')}</label>
                        <Global_Input
                          id={`time-person-withholding-${person.id}`}
                          value={payText(person, 'payWithholdingPct')}
                          onChange={(event) =>
                            setPayDraft((current) => ({
                              ...current,
                              [person.id]: { ...current[person.id], payWithholdingPct: event.target.value },
                            }))
                          }
                          onBlur={() => void savePay(person, 'payWithholdingPct')}
                        />
                      </div>
                    </div>
                  )}
                  {canManage ? (
                    <div className="Time_Tracking_Person_Pick">
                      <Global_Dropdown
                        id={`time-person-${person.id}`}
                        value={personValue(person)}
                        onChange={(value) => void savePerson(person, String(value))}
                        options={[
                          { value: NOBODY, label: t('timeTracking.personNobody') },
                          { value: OWNER, label: t('timeTracking.personOwner') },
                          ...members.map((member) => ({
                            value: member.id,
                            label: member.hasAccount ? member.name : t('timeTracking.memberNoAccount', { name: member.name }),
                            group: t('timeTracking.members'),
                          })),
                        ]}
                      />
                    </div>
                  ) : (
                    <span>
                      {person.member?.name ?? (person.owner ? t('timeTracking.personOwner') : t('timeTracking.personNobody'))}
                    </span>
                  )}
                </div>
              ))}
            </div>
          )}
          <span className="Field_Hint">{t('timeTracking.peopleHint')}</span>
        </div>
      </div>

      {editing && (
        <Time_Client_Popover
          client={editing}
          suppliers={suppliers.map((supplier) => ({ id: supplier.id, name: supplier.name }))}
          appRate={appRateOf(editing)}
          currencyCode={currencyOf(editing.connectionId)}
          saving={saving}
          onClose={() => setEditing(null)}
          onSave={(input) => void saveClient(input)}
        />
      )}
    </>
  );
};

/** Os clientes da app (a que cliente da empresa são, o preço e como se cobram) e a quem vão as horas de cada pessoa. */
const Time_Tracking_Clients = () => (
  <Time_Tracking_Shell>{(company) => <Clients_Body company={company} />}</Time_Tracking_Shell>
);

export default Time_Tracking_Clients;

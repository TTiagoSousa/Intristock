import { useId, useState } from 'react';
import { useTranslation } from 'react-i18next';
import { useCurrencyFormat } from '../../../../Hooks/useCurrencyFormat';
import {
  formatDuration,
  useTimeClients,
  useTimeEntries,
  useTimeHours,
  useTimePeople,
  useTimeSettlements,
  useTimePayouts,
  type Hours_Group,
  type Time_Entry,
} from '../../../../Hooks/Companies/useTimeTracking';
import Time_Payouts_Card from './Time_Payouts_Card';
import Time_Bulk_Pay_Popover, { type Bulk_Group } from './Time_Bulk_Pay_Popover';
import { useCompany } from '../../../../Contexts/Company_Context';
import Simple_Button from '../../../../Components/Buttons/Simple_Button/Simple_Button';
import Time_Settle_Popover from './Time_Settle_Popover';
import Time_Settlements_Card from './Time_Settlements_Card';
import Global_Input from '../../../../Components/Inputs/Global_Input/Global_Input';
import Global_Dropdown from '../../../../Components/Inputs/Global_Dropdown/Global_Dropdown';
import Global_Pagination from '../../../../Components/Pagination/Global_Pagination/Global_Pagination';
import Time_Tracking_Shell from './Time_Tracking_Shell';
import { localeOf } from '../../../../utils/locale';

type Period = 'month' | 'previous' | 'two' | 'custom';
const PERIODS: Period[] = ['month', 'previous', 'two', 'custom'];
const GROUPS: Hours_Group[] = ['month', 'day', 'client'];
const ENTRIES_PAGE = 20;

const iso = (date: Date) => date.toISOString().slice(0, 10);

// Os dias de cada período, contados a partir de hoje (no calendário do browser)
const rangeOf = (period: Exclude<Period, 'custom'>) => {
  const now = new Date();
  const year = now.getFullYear();
  const month = now.getMonth();
  const first = (offset: number) => new Date(Date.UTC(year, month + offset, 1));
  const last = (offset: number) => new Date(Date.UTC(year, month + offset + 1, 0));
  if (period === 'month') return { from: iso(first(0)), to: iso(last(0)) };
  if (period === 'previous') return { from: iso(first(-1)), to: iso(last(-1)) };
  return { from: iso(first(-1)), to: iso(last(0)) };
};

const Hours_Body = ({ company }: { company: { id: string } }) => {
  const { t, i18n } = useTranslation();
  const groupId = useId();
  const { formatMaybeIn } = useCurrencyFormat();
  const locale = localeOf(i18n.language);
  const [period, setPeriod] = useState<Period>('month');
  const [custom, setCustom] = useState(rangeOf('month'));
  const [clientId, setClientId] = useState('');
  const [personId, setPersonId] = useState('');
  const [group, setGroup] = useState<Hours_Group>('month');
  const [status, setStatus] = useState<'' | 'paid' | 'unpaid'>('');
  const [page, setPage] = useState(1);

  const range = period === 'custom' ? custom : rangeOf(period);
  const validRange = range.from && range.to && range.from <= range.to ? range : { from: '', to: '' };
  const { can } = useCompany();
  const canManage = can('timesheet.manage');
  const [settling, setSettling] = useState(false);
  const { data, error, reload } = useTimeHours(company.id, { ...validRange, clientId, personId, group });
  const { data: settlements, reload: reloadSettlements } = useTimeSettlements(company.id, { clientId });
  const { data: payouts, reload: reloadPayouts } = useTimePayouts(company.id, { personId });
  // Os registos escolhidos na tabela (ficam ao mudar de página; saem ao mudar os filtros)
  const [selected, setSelected] = useState<Map<string, Time_Entry>>(new Map());
  const [bulk, setBulk] = useState<'client' | 'worker' | null>(null);
  const { data: entries, reload: reloadEntries } = useTimeEntries(company.id, {
    ...validRange,
    clientId,
    personId,
    status: status || undefined,
    page,
  });
  const { data: clients, reload: reloadClients } = useTimeClients(company.id);
  const reloadData = () => {
    reload();
    reloadEntries();
    reloadSettlements();
    reloadPayouts();
    reloadClients();
  };
  const reloadAll = () => {
    reloadData();
    setSelected(new Map());
  };
  const { data: people } = useTimePeople(company.id);

  // Sem ligações não há moeda: só o número, sem inventar «€»
  const code = data?.currency?.shortCode ?? '';
  const format = (value: number) => formatMaybeIn(value, code);
  const day = (value: string) =>
    new Date(`${value}T00:00:00Z`).toLocaleDateString(locale, { day: '2-digit', month: 'short', year: 'numeric', timeZone: 'UTC' });
  const periodLabel = (value: string | null) =>
    !value
      ? ''
      : value.length === 7
        ? new Date(`${value}-01T00:00:00Z`).toLocaleDateString(locale, { month: 'long', year: 'numeric', timeZone: 'UTC' })
        : day(value);
  const time = (value: string) => new Date(value).toLocaleTimeString(locale, { hour: '2-digit', minute: '2-digit' });
  const resetPage = () => {
    setPage(1);
    setSelected(new Map());
  };
  const toggleEntry = (entry: Time_Entry) =>
    setSelected((current) => {
      const next = new Map(current);
      if (next.has(entry.id)) next.delete(entry.id);
      else next.set(entry.id, entry);
      return next;
    });
  const pageEntries = entries?.entries ?? [];
  const allOnPage = pageEntries.length > 0 && pageEntries.every((entry) => selected.has(entry.id));
  const toggleAll = () =>
    setSelected((current) => {
      const next = new Map(current);
      for (const entry of pageEntries) {
        if (allOnPage) next.delete(entry.id);
        else next.set(entry.id, entry);
      }
      return next;
    });

  // Os grupos da escolha: por cliente (o que falta o cliente pagar) e por pessoa (o que falta pagar-lhe)
  const chosen = [...selected.values()];
  const clientGroups: Bulk_Group[] = [];
  const workerGroups: Bulk_Group[] = [];
  for (const entry of chosen) {
    const clientOpen = entry.billable ? entry.seconds - Math.min(entry.paidSeconds, entry.seconds) : 0;
    if (entry.client && clientOpen > 0) {
      const group = clientGroups.find((row) => row.id === entry.client!.id) ?? {
        id: entry.client.id,
        name: entry.client.name,
        entryIds: [],
        seconds: 0,
        amount: 0,
        linked: Boolean(clients?.find((row) => row.id === entry.client!.id)?.supplier),
      };
      if (!clientGroups.includes(group)) clientGroups.push(group);
      group.entryIds.push(entry.id);
      group.seconds += clientOpen;
      group.amount += entry.unpaidAmount;
    }
    const workerOpen = entry.seconds - Math.min(entry.payoutSeconds, entry.seconds);
    if (entry.person && workerOpen > 0) {
      const person = people?.find((row) => row.id === entry.person!.id);
      const rate = person?.payRate ?? entry.rate;
      const group = workerGroups.find((row) => row.id === entry.person!.id) ?? {
        id: entry.person.id,
        name: entry.person.name,
        entryIds: [],
        seconds: 0,
        amount: 0,
        linked: true,
      };
      if (!workerGroups.includes(group)) workerGroups.push(group);
      group.entryIds.push(entry.id);
      group.seconds += workerOpen;
      group.amount += (workerOpen / 3600) * rate;
    }
  }
  const totals = data?.totals;

  return (
    <>
      <div className="Page_Head">
        <h1>{t('timeTracking.hoursTitle')}</h1>
        {canManage && <Simple_Button text={t('timeTracking.settleAction')} onClick={() => setSettling(true)} auto />}
      </div>

      <div className="Card Time_Tracking_Toolbar">
        <div className="Time_Tracking_Filter">
          <span className="Eyebrow" id={`${groupId}-filterPeriod`}>{t('purchasesDashboard.filterPeriod')}</span>
          <div className="Tabs" role="group" aria-labelledby={`${groupId}-filterPeriod`}>
            {PERIODS.map((option) => (
              <button
                key={option}
                type="button"
                className={period === option ? 'Active' : ''} aria-pressed={period === option}
                onClick={() => {
                  if (option === 'custom' && period !== 'custom') setCustom(range);
                  setPeriod(option);
                  resetPage();
                }}
              >
                {t(`timeTracking.period_${option}`)}
              </button>
            ))}
          </div>
        </div>
        {period === 'custom' && (
          <div className="Time_Tracking_Filter">
            <label className="Eyebrow" htmlFor="time-hours-from">{t('purchasesDashboard.filterRange')}</label>
            <div className="Time_Tracking_Range">
              <Global_Input
                id="time-hours-from"
                type="date"
                value={custom.from}
                onChange={(event) => {
                  setCustom((current) => ({ ...current, from: event.target.value }));
                  resetPage();
                }}
              />
              <span className="Time_Tracking_Sub">{t('purchasesDashboard.rangeTo')}</span>
              <Global_Input
                id="time-hours-to"
                type="date"
                value={custom.to}
                onChange={(event) => {
                  setCustom((current) => ({ ...current, to: event.target.value }));
                  resetPage();
                }}
              />
            </div>
          </div>
        )}
        <div className="Time_Tracking_Filter Wide">
          <label className="Eyebrow" htmlFor="time-hours-client">{t('timeTracking.client')}</label>
          <Global_Dropdown
            id="time-hours-client"
            value={clientId}
            onChange={(value) => {
              setClientId(String(value));
              resetPage();
            }}
            options={[
              { value: '', label: t('timeTracking.allClients') },
              ...(clients ?? []).map((client) => ({ value: client.id, label: client.name })),
            ]}
          />
        </div>
        {(people?.length ?? 0) > 1 && (
          <div className="Time_Tracking_Filter Wide">
            <label className="Eyebrow" htmlFor="time-hours-person">{t('timeTracking.person')}</label>
            <Global_Dropdown
              id="time-hours-person"
              value={personId}
              onChange={(value) => {
                setPersonId(String(value));
                resetPage();
              }}
              options={[
                { value: '', label: t('timeTracking.allPeople') },
                ...(people ?? []).map((person) => ({ value: person.id, label: person.name })),
              ]}
            />
          </div>
        )}
      </div>
      {error && <span className="Time_Tracking_Message Bad">{error}</span>}

      <div className="Grid Auto_190">
        <div className="Card Tile">
          <span className="Eyebrow">{t('timeTracking.totalHours')}</span>
          <span className="Tile_Value">{totals ? formatDuration(totals.seconds) : '—'}</span>
          <div className="Tile_Foot">
            {totals ? t('timeTracking.billableHours', { hours: formatDuration(totals.billableSeconds) }) : ''}
          </div>
        </div>
        <div className="Card Tile">
          <span className="Eyebrow">{t('timeTracking.totalWorth')}</span>
          <span className="Tile_Value">{totals ? format(totals.amount) : '—'}</span>
          <div className="Tile_Foot">{totals ? t('timeTracking.entriesCount', { count: totals.entries }) : ''}</div>
        </div>
        <div className="Card Tile">
          <span className="Eyebrow">{t('timeTracking.totalPaid')}</span>
          <span className="Tile_Value">{totals ? format(totals.paidAmount) : '—'}</span>
          <div className="Tile_Foot">{totals ? formatDuration(totals.paidSeconds) : ''}</div>
        </div>
        <div className="Card Tile">
          <span className="Eyebrow">{t('timeTracking.totalUnpaid')}</span>
          <span className="Tile_Value">{totals ? format(totals.unpaidAmount) : '—'}</span>
          <div className="Tile_Foot">{totals ? formatDuration(totals.unpaidSeconds) : ''}</div>
        </div>
      </div>

      <div className="Card Time_Tracking_Card">
        <div className="Card_Header">
          <div className="Card_Header_Text">
            <span className="Card_Title">{t('timeTracking.byPeriodTitle')}</span>
            <span className="Card_Subtitle">
              {validRange.from ? `${day(validRange.from)} – ${day(validRange.to)}` : t('timeTracking.invalidRange')}
            </span>
          </div>
          <div className="Time_Tracking_Controls">
            <div className="Tabs">
              {GROUPS.map((option) => (
                <button key={option} type="button" className={group === option ? 'Active' : ''} aria-pressed={group === option} onClick={() => setGroup(option)}>
                  {t(`timeTracking.group_${option}`)}
                </button>
              ))}
            </div>
          </div>
        </div>
        <div className="Time_Tracking_Body">
          {!data ? (
            <span className="Time_Tracking_Message">{validRange.from ? t('common.loading') : t('timeTracking.invalidRange')}</span>
          ) : data.rows.length === 0 ? (
            <span className="Time_Tracking_Message">{t('timeTracking.noHours')}</span>
          ) : (
            <div className="Table_Wrap">
              <table className="Table">
                <thead>
                  <tr>
                    {group !== 'client' && <th>{t(group === 'day' ? 'timeTracking.day' : 'timeTracking.month')}</th>}
                    <th>{t('timeTracking.client')}</th>
                    <th className="Right">{t('timeTracking.hours')}</th>
                    <th className="Right">{t('timeTracking.worth')}</th>
                    <th className="Right">{t('timeTracking.paid')}</th>
                    <th className="Right">{t('timeTracking.unpaid')}</th>
                  </tr>
                </thead>
                <tbody>
                  {data.rows.map((row) => (
                    <tr key={`${row.period ?? ''}|${row.client?.id ?? 'none'}`}>
                      {group !== 'client' && <td className="Time_Tracking_Capital">{periodLabel(row.period)}</td>}
                      <td>{row.client?.name ?? t('timeTracking.noClient')}</td>
                      <td className="Right Num">{formatDuration(row.seconds)}</td>
                      <td className="Right Num">{format(row.amount)}</td>
                      <td className="Right Num">{row.paidAmount > 0 ? format(row.paidAmount) : '—'}</td>
                      <td className="Right Num">
                        {row.unpaidAmount > 0 ? <span className="Pill Warn">{format(row.unpaidAmount)}</span> : '—'}
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          )}
        </div>
      </div>

      <div className="Card Time_Tracking_Card">
        <div className="Card_Header">
          <div className="Card_Header_Text">
            <span className="Card_Title">{t('timeTracking.entriesTitle')}</span>
            <span className="Card_Subtitle">{t('timeTracking.entriesSubtitle')}</span>
          </div>
          <div className="Time_Tracking_Controls">
            <div className="Tabs">
              {(['', 'unpaid', 'paid'] as const).map((option) => (
                <button
                  key={option || 'all'}
                  type="button"
                  className={status === option ? 'Active' : ''} aria-pressed={status === option}
                  onClick={() => {
                    setStatus(option);
                    resetPage();
                  }}
                >
                  {t(`timeTracking.status_${option || 'all'}`)}
                </button>
              ))}
            </div>
          </div>
        </div>
        <div className="Time_Tracking_Body">
          {!entries ? (
            <span className="Time_Tracking_Message">{validRange.from ? t('common.loading') : t('timeTracking.invalidRange')}</span>
          ) : entries.entries.length === 0 ? (
            <span className="Time_Tracking_Message">{t('timeTracking.noHours')}</span>
          ) : (
            <>
              {canManage && selected.size > 0 && (
                <div className="Time_Tracking_Selection">
                  <span className="Time_Tracking_Sub">{t('timeTracking.selectedCount', { count: selected.size })}</span>
                  <div className="Time_Tracking_Selection_Actions">
                    <Simple_Button text={t('timeTracking.clearSelection')} variant="Ghost" auto onClick={() => setSelected(new Map())} />
                    <Simple_Button
                      text={t('timeTracking.clientPaid')}
                      variant="Ghost"
                      auto
                      disabled={clientGroups.length === 0}
                      onClick={() => setBulk('client')}
                    />
                    <Simple_Button
                      text={t('timeTracking.payWorker')}
                      auto
                      disabled={workerGroups.length === 0}
                      onClick={() => setBulk('worker')}
                    />
                  </div>
                </div>
              )}
              <div className="Table_Wrap">
                <table className="Table">
                  <thead>
                    <tr>
                      {canManage && (
                        <th className="Time_Tracking_Pick">
                          <input
                            type="checkbox"
                            checked={allOnPage}
                            onChange={toggleAll}
                            aria-label={t('timeTracking.selectAll')}
                          />
                        </th>
                      )}
                      <th>{t('timeTracking.day')}</th>
                      <th>{t('timeTracking.client')}</th>
                      <th>{t('timeTracking.description')}</th>
                      <th className="Right">{t('timeTracking.hours')}</th>
                      <th className="Right">{t('timeTracking.worth')}</th>
                      <th className="Right">{t('timeTracking.stateClient')}</th>
                      <th className="Right">{t('timeTracking.stateWorker')}</th>
                    </tr>
                  </thead>
                  <tbody>
                    {entries.entries.map((entry) => (
                      <tr key={entry.id}>
                        {canManage && (
                          <td className="Time_Tracking_Pick">
                            <input
                              type="checkbox"
                              checked={selected.has(entry.id)}
                              onChange={() => toggleEntry(entry)}
                              aria-label={t('timeTracking.selectEntry')}
                            />
                          </td>
                        )}
                        <td className="Num">
                          {new Date(entry.start).toLocaleDateString(locale, { day: '2-digit', month: 'short' })}
                          <div className="Time_Tracking_Sub">
                            {time(entry.start)}
                            {entry.end ? `–${time(entry.end)}` : ''}
                          </div>
                        </td>
                        <td>
                          {entry.client?.name ?? t('timeTracking.noClient')}
                          {entry.project && <div className="Time_Tracking_Sub">{entry.project.name}</div>}
                        </td>
                        <td>
                          {entry.description || <span className="Time_Tracking_Sub">—</span>}
                          {entry.person && (people?.length ?? 0) > 1 && <div className="Time_Tracking_Sub">{entry.person.name}</div>}
                        </td>
                        <td className="Right Num">{formatDuration(entry.seconds)}</td>
                        <td className="Right Num">
                          {entry.billable ? format(entry.amount) : <span className="Time_Tracking_Sub">{t('timeTracking.notBillable')}</span>}
                        </td>
                        <td className="Right">
                          {!entry.billable ? (
                            '—'
                          ) : entry.paidSeconds >= entry.seconds ? (
                            <span className="Pill Ok">{t('timeTracking.paid')}</span>
                          ) : entry.paidSeconds > 0 ? (
                            <span className="Pill Info">{t('timeTracking.partlyPaid')}</span>
                          ) : (
                            <span className="Pill Warn">{t('timeTracking.unpaid')}</span>
                          )}
                        </td>
                        <td className="Right">
                          {!entry.person ? (
                            '—'
                          ) : entry.payoutSeconds >= entry.seconds ? (
                            <span className="Pill Ok">{t('timeTracking.paid')}</span>
                          ) : entry.payoutSeconds > 0 ? (
                            <span className="Pill Info">{t('timeTracking.partlyPaid')}</span>
                          ) : (
                            <span className="Pill Warn">{t('timeTracking.unpaid')}</span>
                          )}
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
              <Global_Pagination
                page={page}
                totalPages={Math.max(1, Math.ceil(entries.total / ENTRIES_PAGE))}
                onPageChange={setPage}
                totalItems={entries.total}
                pageSize={ENTRIES_PAGE}
              />
            </>
          )}
        </div>
      </div>

      <Time_Settlements_Card
        companyId={company.id}
        settlements={settlements}
        canManage={canManage}
        onChanged={reloadAll}
      />

      <Time_Payouts_Card companyId={company.id} payouts={payouts} canManage={canManage} onChanged={reloadAll} />

      {bulk && (
        <Time_Bulk_Pay_Popover
          companyId={company.id}
          kind={bulk}
          groups={bulk === 'client' ? clientGroups : workerGroups}
          currencyCode={code}
          onClose={() => setBulk(null)}
          onDone={() => {
            setBulk(null);
            reloadAll();
          }}
          onPartial={reloadData}
        />
      )}

      {settling && (
        <Time_Settle_Popover
          companyId={company.id}
          clients={clients ?? []}
          people={people ?? []}
          currencyCode={code}
          initial={{ clientId, personId, ...validRange }}
          onClose={() => setSettling(false)}
          onDone={() => {
            setSettling(false);
            reloadAll();
          }}
        />
      )}
    </>
  );
};

/** As horas de um período: por mês, dia ou cliente, com o valor e o que está pago, e os registos um a um. */
const Time_Tracking_Hours = () => (
  <Time_Tracking_Shell>{(company) => <Hours_Body company={company} />}</Time_Tracking_Shell>
);

export default Time_Tracking_Hours;

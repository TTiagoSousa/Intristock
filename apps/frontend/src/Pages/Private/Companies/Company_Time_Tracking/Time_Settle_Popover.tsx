import { useEffect, useId, useState } from 'react';
import { useTranslation } from 'react-i18next';
import Simple_Button from '../../../../Components/Buttons/Simple_Button/Simple_Button';
import Global_Input from '../../../../Components/Inputs/Global_Input/Global_Input';
import Global_Dropdown from '../../../../Components/Inputs/Global_Dropdown/Global_Dropdown';
import { useAlert } from '../../../../Contexts/Alert_Context';
import { getErrorMessage } from '../../../../Hooks/useAsyncRequest';
import { useCurrencyFormat } from '../../../../Hooks/useCurrencyFormat';
import { useCompanyBankAccounts } from '../../../../Hooks/Companies/useCompanyBankAccounts';
import { useCompany } from '../../../../Contexts/Company_Context';
import { localToday } from '../../../../utils/dates';
import { localeOf } from '../../../../utils/locale';
import Popover_Shell from '../../../../Components/Popover_Shell/Popover_Shell';
import {
  timeTrackingApi,
  useTimeConnections,
  type Settlement_Input,
  type Time_Client,
  type Time_Person,
} from '../../../../Hooks/Companies/useTimeTracking';

interface Time_Settle_Popover_Props {
  companyId: string;
  clients: Time_Client[];
  people: Time_Person[];
  currencyCode: string;
  // O que já está escolhido no ecrã de onde se abre (o cliente, as datas, a pessoa)
  initial: { clientId?: string; from?: string; to?: string; personId?: string };
  onClose: () => void;
  onDone: () => void;
}

const parseNumber = (value: string) => {
  const text = value.trim().replace(',', '.');
  if (!text) return null;
  const number = Number(text);
  return Number.isFinite(number) && number >= 0 ? number : NaN;
};

/**
 * Marcar horas como pagas. Por datas: as horas por pagar do cliente nesse período (pelo valor
 * delas ou pelo que se escrever). Por horas: o cliente pagou X por N horas («50 € por 5 h»):
 * pagam-se as horas por pagar mais antigas e as que sobram ficam adiantadas para as que vierem.
 * Opcional: gravar o recebimento numa conta da empresa (precisa do cliente da empresa ligado).
 */
const Time_Settle_Popover = ({ companyId, clients, people, currencyCode, initial, onClose, onDone }: Time_Settle_Popover_Props) => {
  const { t, i18n } = useTranslation();
  const groupId = useId();
  const { setAlert } = useAlert();
  const { formatMaybeIn } = useCurrencyFormat();
  const { bankAccounts } = useCompanyBankAccounts(companyId);
  const { company } = useCompany();
  const { data: connections } = useTimeConnections(companyId);
  const formatHours = (seconds: number) =>
    new Intl.NumberFormat(localeOf(i18n.language), { maximumFractionDigits: 2 }).format(seconds / 3600);
  const billable = clients.filter((client) => client.billing !== 'none' && !client.isArchived);
  const [clientId, setClientId] = useState(initial.clientId && billable.some((c) => c.id === initial.clientId) ? initial.clientId : (billable[0]?.id ?? ''));
  const [mode, setMode] = useState<'range' | 'hours'>('range');
  const [from, setFrom] = useState(initial.from ?? '');
  const [to, setTo] = useState(initial.to ?? '');
  const [hours, setHours] = useState('');
  const [amount, setAmount] = useState('');
  const [personId, setPersonId] = useState(initial.personId ?? '');
  const client = billable.find((row) => row.id === clientId) ?? null;
  const [withholding, setWithholding] = useState('');
  const [paidAt, setPaidAt] = useState(localToday());
  const [account, setAccount] = useState('');
  const [note, setNote] = useState('');
  const [saving, setSaving] = useState(false);

  useEffect(() => {
    setWithholding(client?.billing === 'freelance' && client.withholdingPct !== null ? String(client.withholdingPct) : '');
  }, [client]);

  const peopleOfClient = people.filter((person) => !client || person.connectionId === client.connectionId);
  const hoursValue = parseNumber(hours);
  const amountValue = parseNumber(amount);
  const withholdingValue = parseNumber(withholding);
  const invalid =
    !client ||
    !paidAt ||
    Number.isNaN(amountValue) ||
    Number.isNaN(withholdingValue) ||
    (withholdingValue !== null && withholdingValue > 100) ||
    (mode === 'range' ? !from || !to || from > to : !hoursValue || Number.isNaN(hoursValue) || amountValue === null);
  const rate = mode === 'hours' && hoursValue && amountValue ? amountValue / hoursValue : null;
  const net = amountValue !== null && !Number.isNaN(amountValue) ? amountValue * (1 - (withholdingValue || 0) / 100) : null;
  // O recebimento fica na moeda da ligação do cliente: a conta tem de estar nela
  // ou na da empresa (o backend recusa as outras)
  const paymentCurrencyId = connections?.find((row) => row.id === client?.connectionId)?.currency.id;
  const accounts = bankAccounts.filter(
    (row) =>
      row.status === 'active' &&
      (!paymentCurrencyId || row.currencyId === paymentCurrencyId || row.currencyId === company?.currencyId),
  );

  // Uma conta escolhida que deixou de servir (mudou o cliente) não vai no pedido
  const chosenAccount = accounts.some((row) => row.id === account) ? account : '';

  // A meio da gravação não se fecha (o Esc e o clique no fundo esperam)
  const close = () => {
    if (!saving) onClose();
  };

  const submit = async () => {
    if (invalid || saving || !client) return;
    const body: Settlement_Input = {
      clientId: client.id,
      mode,
      paidAt,
      ...(personId ? { personId } : {}),
      ...(mode === 'range' ? { fromDate: from, toDate: to } : { hours: hoursValue!, ...(from ? { fromDate: from } : {}) }),
      ...(amountValue !== null ? { amount: amountValue } : {}),
      withholdingPct: withholdingValue,
      ...(chosenAccount ? { toBankAccountId: chosenAccount } : {}),
      ...(note.trim() ? { note: note.trim() } : {}),
    };
    setSaving(true);
    try {
      const settlement = await timeTrackingApi.settle(companyId, body);
      setAlert({
        open: true,
        type: 'success',
        message:
          settlement.creditSeconds > 0
            ? t('timeTracking.settledWithCredit', { hours: formatHours(settlement.creditSeconds) })
            : t('timeTracking.settled'),
      });
      onDone();
    } catch (reason) {
      setAlert({ open: true, message: getErrorMessage(reason), type: 'error' });
    } finally {
      setSaving(false);
    }
  };

  return (
    <Popover_Shell onClose={close} className="Narrow">
      <div className="Popover_Header">
        <div className="Popover_Header_Text">
          <span className="Popover_Title">{t('timeTracking.settleTitle')}</span>
          <span className="Popover_Subtitle">{t('timeTracking.settleSubtitle')}</span>
        </div>
        <button type="button" className="Popover_Close" onClick={close} aria-label={t('common.cancel')}>
          ×
        </button>
      </div>

      <div className="Popover_Body Single_Column">
        {billable.length === 0 ? (
          <span className="Field_Hint">{t('timeTracking.settleNoClients')}</span>
        ) : (
          <>
            <div className="Form_Field">
              <label htmlFor="settle-client">{t('timeTracking.client')}</label>
              <Global_Dropdown
                id="settle-client"
                value={clientId}
                onChange={(value) => setClientId(String(value))}
                options={billable.map((row) => ({ value: row.id, label: row.name }))}
              />
              {client && client.creditSeconds > 0 && (
                <span className="Field_Hint">
                  {t('timeTracking.clientCredit', { hours: formatHours(client.creditSeconds) })}
                </span>
              )}
            </div>

            <div className="Form_Field">
              <label id={`${groupId}-settleMode`}>{t('timeTracking.settleMode')}</label>
              <div className="Tabs" role="group" aria-labelledby={`${groupId}-settleMode`}>
                {(['range', 'hours'] as const).map((option) => (
                  <button key={option} type="button" className={mode === option ? 'Active' : ''} aria-pressed={mode === option} onClick={() => setMode(option)}>
                    {t(`timeTracking.settleMode_${option}`)}
                  </button>
                ))}
              </div>
              <span className="Field_Hint">{t(`timeTracking.settleModeHint_${mode}`)}</span>
            </div>

            {mode === 'hours' && (
              <div className="Form_Field">
                <label htmlFor="settle-hours">{t('timeTracking.settleHours')}</label>
                <Global_Input id="settle-hours" value={hours} onChange={(event) => setHours(event.target.value)} />
              </div>
            )}

            <div className="Form_Field">
              <label htmlFor="settle-from">
                {mode === 'range' ? t('timeTracking.settleFrom') : t('timeTracking.settleFromOptional')}
              </label>
              <Global_Input id="settle-from" type="date" value={from} onChange={(event) => setFrom(event.target.value)} />
            </div>
            {mode === 'range' && (
              <div className="Form_Field">
                <label htmlFor="settle-to">{t('timeTracking.settleTo')}</label>
                <Global_Input id="settle-to" type="date" value={to} onChange={(event) => setTo(event.target.value)} />
              </div>
            )}

            <div className="Form_Field">
              <label htmlFor="settle-amount">
                {t(mode === 'range' ? 'timeTracking.settleAmountOptional' : 'timeTracking.settleAmount', {
                  currency: currencyCode,
                })}
              </label>
              <Global_Input id="settle-amount" value={amount} onChange={(event) => setAmount(event.target.value)} />
              <span className="Field_Hint">
                {mode === 'range'
                  ? t('timeTracking.settleAmountHint')
                  : rate !== null
                    ? t('timeTracking.settleRate', { rate: formatMaybeIn(rate, currencyCode) })
                    : t('timeTracking.settleRateHint')}
              </span>
            </div>

            {peopleOfClient.length > 1 && (
              <div className="Form_Field">
                <label htmlFor="settle-person">{t('timeTracking.person')}</label>
                <Global_Dropdown
                  id="settle-person"
                  value={personId}
                  onChange={(value) => setPersonId(String(value))}
                  options={[
                    { value: '', label: t('timeTracking.allPeople') },
                    ...peopleOfClient.map((person) => ({ value: person.id, label: person.name })),
                  ]}
                />
              </div>
            )}

            <div className="Form_Field">
              <label htmlFor="settle-withholding">{t('timeTracking.withholding')}</label>
              <Global_Input id="settle-withholding" value={withholding} onChange={(event) => setWithholding(event.target.value)} />
              {net !== null && (
                <span className="Field_Hint">{t('timeTracking.settleNet', { amount: formatMaybeIn(net, currencyCode) })}</span>
              )}
            </div>

            <div className="Form_Field">
              <label htmlFor="settle-paid-at">{t('timeTracking.settlePaidAt')}</label>
              <Global_Input id="settle-paid-at" type="date" value={paidAt} onChange={(event) => setPaidAt(event.target.value)} />
            </div>

            <div className="Form_Field">
              <label htmlFor="settle-account">{t('timeTracking.settleAccount')}</label>
              <Global_Dropdown
                id="settle-account"
                value={chosenAccount}
                onChange={(value) => setAccount(String(value))}
                disabled={!client?.supplier}
                options={[
                  { value: '', label: t('timeTracking.settleNoAccount') },
                  ...accounts.map((row) => ({ value: row.id, label: row.name })),
                ]}
              />
              <span className="Field_Hint">
                {client?.supplier ? t('timeTracking.settleAccountHint') : t('timeTracking.settleAccountNeedsClient')}
              </span>
            </div>

            <div className="Form_Field">
              <label htmlFor="settle-note">{t('timeTracking.settleNote')}</label>
              <Global_Input id="settle-note" value={note} onChange={(event) => setNote(event.target.value)} />
            </div>
          </>
        )}
      </div>

      <div className="Popover_Footer">
        <div className="Form_Action">
          <Simple_Button text={t('common.cancel')} onClick={close} variant="Ghost" />
        </div>
        <div className="Form_Action">
          <Simple_Button text={t('timeTracking.settleSave')} onClick={submit} disabled={invalid || saving} />
        </div>
      </div>
    </Popover_Shell>
  );
};

export default Time_Settle_Popover;

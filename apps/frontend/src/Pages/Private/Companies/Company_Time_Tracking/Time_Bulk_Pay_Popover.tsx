import { useState } from 'react';
import { useTranslation } from 'react-i18next';
import Simple_Button from '../../../../Components/Buttons/Simple_Button/Simple_Button';
import Global_Input from '../../../../Components/Inputs/Global_Input/Global_Input';
import Global_Dropdown from '../../../../Components/Inputs/Global_Dropdown/Global_Dropdown';
import { useAlert } from '../../../../Contexts/Alert_Context';
import { getErrorMessage } from '../../../../Hooks/useAsyncRequest';
import { useCurrencyFormat } from '../../../../Hooks/useCurrencyFormat';
import { useCompanyBankAccounts } from '../../../../Hooks/Companies/useCompanyBankAccounts';
import { formatDuration, timeTrackingApi, useTimeConnections, useTimeClients, useTimePeople } from '../../../../Hooks/Companies/useTimeTracking';
import { useCompany } from '../../../../Contexts/Company_Context';
import { localToday } from '../../../../utils/dates';
import Popover_Shell from '../../../../Components/Popover_Shell/Popover_Shell';

/** Um grupo dos registos escolhidos: um cliente (o cliente pagou) ou uma pessoa (pagar à pessoa). */
export interface Bulk_Group {
  id: string;
  name: string;
  entryIds: string[];
  seconds: number;
  amount: number;
  // O cliente está ligado a um cliente da empresa (só então se grava o recebimento)
  linked: boolean;
}

interface Time_Bulk_Pay_Popover_Props {
  companyId: string;
  kind: 'client' | 'worker';
  groups: Bulk_Group[];
  currencyCode: string;
  onClose: () => void;
  onDone: () => void;
  // Uma parte gravou-se e outra falhou: o ecrã recarrega sem perder a escolha
  onPartial: () => void;
}

/**
 * Pagar os registos escolhidos na tabela das horas: «Cliente pagou» faz uma liquidação por
 * cliente (`mode` entries) e «Pagar ao funcionário» um pagamento por pessoa. A data, a conta da
 * empresa (opcional) e, com um só grupo, o valor se não for o das horas.
 */
const Time_Bulk_Pay_Popover = ({ companyId, kind, groups: allGroups, currencyCode, onClose, onDone, onPartial }: Time_Bulk_Pay_Popover_Props) => {
  const { t } = useTranslation();
  const { setAlert } = useAlert();
  const { formatMaybeIn } = useCurrencyFormat();
  const { bankAccounts } = useCompanyBankAccounts(companyId);
  const { company } = useCompany();
  const { data: connections } = useTimeConnections(companyId);
  const { data: clients } = useTimeClients(kind === 'client' ? companyId : undefined);
  const { data: people } = useTimePeople(kind === 'worker' ? companyId : undefined);
  // Os grupos que já ficaram gravados (numa gravação que falhou a meio) saem da lista
  const [doneGroups, setDoneGroups] = useState<Set<string>>(new Set());
  const groups = allGroups.filter((group) => !doneGroups.has(group.id));
  const [paidAt, setPaidAt] = useState(localToday());
  const [account, setAccount] = useState('');
  const [amount, setAmount] = useState('');
  const [saving, setSaving] = useState(false);

  // A meio da gravação não se fecha (o Esc e o clique no fundo esperam)
  const close = () => {
    if (!saving) onClose();
  };

  const single = groups.length === 1;
  const amountValue = amount.trim() ? Number(amount.trim().replace(',', '.')) : null;
  const invalid = !paidAt || (amountValue !== null && (!Number.isFinite(amountValue) || amountValue < 0));
  // Cada pagamento fica na moeda da ligação do grupo: a conta tem de estar nela ou
  // na da empresa (o backend recusa as outras)
  const connectionOf = (group: Bulk_Group) =>
    kind === 'client'
      ? clients?.find((row) => row.id === group.id)?.connectionId
      : people?.find((row) => row.id === group.id)?.connectionId;
  const groupCurrencies = new Set(
    groups
      .map((group) => connections?.find((row) => row.id === connectionOf(group))?.currency.id)
      .filter((id): id is string => Boolean(id)),
  );
  const accounts = bankAccounts.filter(
    (row) =>
      row.status === 'active' &&
      (row.currencyId === company?.currencyId ||
        (groupCurrencies.size > 0 && [...groupCurrencies].every((id) => id === row.currencyId))),
  );
  const chosenAccount = accounts.some((row) => row.id === account) ? account : '';
  const total = groups.reduce((sum, group) => sum + group.amount, 0);

  const submit = async () => {
    if (invalid || saving) return;
    setSaving(true);
    const done: Bulk_Group[] = [];
    let current: Bulk_Group | null = null;
    try {
      for (const group of groups) {
        current = group;
        const custom = single && amountValue !== null ? { amount: amountValue } : {};
        if (kind === 'client')
          await timeTrackingApi.settle(companyId, {
            clientId: group.id,
            mode: 'entries',
            entryIds: group.entryIds,
            paidAt,
            ...custom,
            ...(chosenAccount && group.linked ? { toBankAccountId: chosenAccount } : {}),
          });
        else
          await timeTrackingApi.payout(companyId, {
            entryIds: group.entryIds,
            paidAt,
            ...custom,
            ...(chosenAccount ? { fromBankAccountId: chosenAccount } : {}),
          });
        done.push(group);
      }
      setAlert({ open: true, type: 'success', message: t(kind === 'client' ? 'timeTracking.bulkClientDone' : 'timeTracking.bulkWorkerDone', { count: done.length }) });
      onDone();
    } catch (reason) {
      // Diz o que ficou gravado e o que falhou; a janela fica aberta com os que faltam
      const error = getErrorMessage(reason);
      setAlert({
        open: true,
        type: 'error',
        message: done.length
          ? t('timeTracking.bulkPartial', {
              done: done.map((group) => group.name).join(', '),
              failed: current?.name ?? '',
              error,
            })
          : error,
      });
      if (done.length) {
        setDoneGroups((previous) => new Set([...previous, ...done.map((group) => group.id)]));
        onPartial();
      }
    } finally {
      setSaving(false);
    }
  };

  return (
    <Popover_Shell onClose={close} className="Narrow">
      <div className="Popover_Header">
        <div className="Popover_Header_Text">
          <span className="Popover_Title">{t(kind === 'client' ? 'timeTracking.bulkClientTitle' : 'timeTracking.bulkWorkerTitle')}</span>
          <span className="Popover_Subtitle">
            {t(kind === 'client' ? 'timeTracking.bulkClientSubtitle' : 'timeTracking.bulkWorkerSubtitle')}
          </span>
        </div>
        <button type="button" className="Popover_Close" onClick={close} aria-label={t('common.cancel')}>
          ×
        </button>
      </div>

      <div className="Popover_Body Single_Column">
        <div className="Time_Tracking_List">
          {groups.map((group) => (
            <div key={group.id} className="Time_Tracking_List_Row">
              <div className="Time_Tracking_List_Text">
                <span className="Time_Tracking_Strong">{group.name}</span>
                <span className="Time_Tracking_Sub">
                  {t('timeTracking.bulkEntries', { count: group.entryIds.length })} · {formatDuration(group.seconds)}
                </span>
              </div>
              <span className="Num">{formatMaybeIn(group.amount, currencyCode)}</span>
            </div>
          ))}
        </div>
        {!single && <span className="Field_Hint">{t('timeTracking.bulkTotal', { amount: formatMaybeIn(total, currencyCode) })}</span>}

        {single && (
          <div className="Form_Field">
            <label htmlFor="bulk-amount">{t('timeTracking.settleAmountOptional', { currency: currencyCode })}</label>
            <Global_Input id="bulk-amount" value={amount} onChange={(event) => setAmount(event.target.value)} />
            <span className="Field_Hint">
              {t(kind === 'client' ? 'timeTracking.settleAmountHint' : 'timeTracking.payoutAmountHint')}
            </span>
          </div>
        )}

        <div className="Form_Field">
          <label htmlFor="bulk-paid-at">{t('timeTracking.settlePaidAt')}</label>
          <Global_Input id="bulk-paid-at" type="date" value={paidAt} onChange={(event) => setPaidAt(event.target.value)} />
        </div>

        <div className="Form_Field">
          <label htmlFor="bulk-account">
            {t(kind === 'client' ? 'timeTracking.settleAccount' : 'timeTracking.payoutAccount')}
          </label>
          <Global_Dropdown
            id="bulk-account"
            value={chosenAccount}
            onChange={(value) => setAccount(String(value))}
            options={[
              { value: '', label: t('timeTracking.settleNoAccount') },
              ...accounts.map((row) => ({ value: row.id, label: row.name })),
            ]}
          />
          <span className="Field_Hint">
            {accounts.length === 0
              ? t('timeTracking.noCompanyAccounts')
              : t(kind === 'client' ? 'timeTracking.bulkClientAccountHint' : 'timeTracking.payoutAccountHint')}
          </span>
        </div>
      </div>

      <div className="Popover_Footer">
        <div className="Form_Action">
          <Simple_Button text={t('common.cancel')} onClick={close} variant="Ghost" />
        </div>
        <div className="Form_Action">
          <Simple_Button
            text={t(kind === 'client' ? 'timeTracking.clientPaid' : 'timeTracking.payWorker')}
            onClick={submit}
            disabled={invalid || saving || groups.length === 0}
          />
        </div>
      </div>
    </Popover_Shell>
  );
};

export default Time_Bulk_Pay_Popover;

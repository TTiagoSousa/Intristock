import { useState } from 'react';
import { useTranslation } from 'react-i18next';
import { useAlert } from '../../../../Contexts/Alert_Context';
import { getErrorMessage } from '../../../../Hooks/useAsyncRequest';
import { useCurrencyFormat } from '../../../../Hooks/useCurrencyFormat';
import {
  formatDuration,
  timeTrackingApi,
  type Time_Settlement,
} from '../../../../Hooks/Companies/useTimeTracking';
import Confirm_Popover from '../../../../Components/Confirm_Popover/Confirm_Popover';
import { localeOf } from '../../../../utils/locale';

interface Time_Settlements_Card_Props {
  companyId: string;
  settlements: Time_Settlement[] | null;
  canManage: boolean;
  onChanged: () => void;
}

/** O que os clientes pagaram à empresa: o que cobriu, as horas adiantadas que sobram, se o recebimento ficou gravado e o desfazer. */
const Time_Settlements_Card = ({ companyId, settlements, canManage, onChanged }: Time_Settlements_Card_Props) => {
  const { t, i18n } = useTranslation();
  const { setAlert } = useAlert();
  const { formatIn } = useCurrencyFormat();
  const locale = localeOf(i18n.language);
  const [undoing, setUndoing] = useState<Time_Settlement | null>(null);
  const [saving, setSaving] = useState(false);
  const day = (value: string) =>
    new Date(`${value}T00:00:00Z`).toLocaleDateString(locale, { day: '2-digit', month: 'short', year: 'numeric', timeZone: 'UTC' });

  const undo = async () => {
    if (!undoing) return;
    setSaving(true);
    try {
      await timeTrackingApi.unsettle(companyId, undoing.id);
      setAlert({ open: true, type: 'success', message: t('timeTracking.unsettled') });
      setUndoing(null);
      onChanged();
    } catch (reason) {
      setAlert({ open: true, type: 'error', message: getErrorMessage(reason) });
    } finally {
      setSaving(false);
    }
  };

  return (
    <div className="Card Time_Tracking_Card">
      <div className="Card_Header">
        <div className="Card_Header_Text">
          <span className="Card_Title">{t('timeTracking.settlementsTitle')}</span>
          <span className="Card_Subtitle">{t('timeTracking.settlementsSubtitle')}</span>
        </div>
      </div>
      <div className="Time_Tracking_Body">
        {!settlements ? (
          <span className="Time_Tracking_Message">{t('common.loading')}</span>
        ) : settlements.length === 0 ? (
          <span className="Time_Tracking_Message">{t('timeTracking.noSettlements')}</span>
        ) : (
          <div className="Table_Wrap">
            <table className="Table">
              <thead>
                <tr>
                  <th>{t('timeTracking.settlePaidAt')}</th>
                  <th>{t('timeTracking.client')}</th>
                  <th>{t('timeTracking.settleCovers')}</th>
                  <th className="Right">{t('timeTracking.hours')}</th>
                  <th className="Right">{t('timeTracking.settleNetShort')}</th>
                  <th>{t('timeTracking.settleInCompany')}</th>
                  {canManage && <th />}
                </tr>
              </thead>
              <tbody>
                {settlements.map((settlement) => (
                  <tr key={settlement.id}>
                    <td className="Num">{day(settlement.paidAt)}</td>
                    <td>
                      {settlement.client.name}
                      {settlement.person && <div className="Time_Tracking_Sub">{settlement.person.name}</div>}
                    </td>
                    <td>
                      {settlement.mode === 'range' && settlement.fromDate && settlement.toDate
                        ? `${day(settlement.fromDate)} – ${day(settlement.toDate)}`
                        : t('timeTracking.settleCoversHours', { rate: formatIn(settlement.hourlyRate, settlement.currency.shortCode) })}
                      {settlement.note && <div className="Time_Tracking_Sub">{settlement.note}</div>}
                    </td>
                    <td className="Right Num">
                      {formatDuration(settlement.seconds)}
                      {settlement.creditSeconds > 0 && (
                        <div className="Time_Tracking_Sub">
                          {t('timeTracking.creditLeft', { hours: formatDuration(settlement.creditSeconds) })}
                        </div>
                      )}
                    </td>
                    <td className="Right Num">
                      {formatIn(settlement.netAmount, settlement.currency.shortCode)}
                    </td>
                    <td>
                      {settlement.companyPayment ? (
                        <span className="Pill Ok">{t('timeTracking.recordedInCompany')}</span>
                      ) : (
                        <span className="Time_Tracking_Sub">{t('timeTracking.notRecorded')}</span>
                      )}
                    </td>
                    {canManage && (
                      <td className="Right">
                        <button type="button" className="Time_Tracking_Link" onClick={() => setUndoing(settlement)}>
                          {t('timeTracking.unsettle')}
                        </button>
                      </td>
                    )}
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </div>
      {undoing && (
        <Confirm_Popover
          title={t('timeTracking.unsettleTitle')}
          subtitle={undoing.client.name}
          message={t(undoing.companyPayment ? 'timeTracking.unsettleMessageWithPayment' : 'timeTracking.unsettleMessage')}
          confirmText={t('timeTracking.unsettle')}
          busy={saving}
          onClose={() => setUndoing(null)}
          onConfirm={undo}
        />
      )}
    </div>
  );
};

export default Time_Settlements_Card;

import { useState } from 'react';
import { useTranslation } from 'react-i18next';
import { useAlert } from '../../../../Contexts/Alert_Context';
import { getErrorMessage } from '../../../../Hooks/useAsyncRequest';
import { useCurrencyFormat } from '../../../../Hooks/useCurrencyFormat';
import {
  formatDuration,
  timeTrackingApi,
  type Payout_Check,
  type Time_Payout,
} from '../../../../Hooks/Companies/useTimeTracking';
import Confirm_Popover from '../../../../Components/Confirm_Popover/Confirm_Popover';
import { localeOf } from '../../../../utils/locale';

interface Time_Payouts_Card_Props {
  companyId: string;
  payouts: Time_Payout[] | null;
  canManage: boolean;
  onChanged: () => void;
}

// O tom de cada estado do cruzamento com a pessoa que recebeu
const CHECK_TONE: Record<Payout_Check, string> = { received: 'Ok', awaiting: 'Info', different: 'Bad', none: '' };

/** O que a empresa pagou a quem fez as horas: quanto, se a pessoa já confirmou e o desfazer. */
const Time_Payouts_Card = ({ companyId, payouts, canManage, onChanged }: Time_Payouts_Card_Props) => {
  const { t, i18n } = useTranslation();
  const { setAlert } = useAlert();
  const { formatIn } = useCurrencyFormat();
  const locale = localeOf(i18n.language);
  const [undoing, setUndoing] = useState<Time_Payout | null>(null);
  const [saving, setSaving] = useState(false);
  const day = (value: string) =>
    new Date(`${value}T00:00:00Z`).toLocaleDateString(locale, { day: '2-digit', month: 'short', year: 'numeric', timeZone: 'UTC' });

  const undo = async () => {
    if (!undoing) return;
    setSaving(true);
    try {
      await timeTrackingApi.unpayout(companyId, undoing.id);
      setAlert({ open: true, type: 'success', message: t('timeTracking.unpaidOut') });
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
          <span className="Card_Title">{t('timeTracking.payoutsTitle')}</span>
          <span className="Card_Subtitle">{t('timeTracking.payoutsSubtitle')}</span>
        </div>
      </div>
      <div className="Time_Tracking_Body">
        {!payouts ? (
          <span className="Time_Tracking_Message">{t('common.loading')}</span>
        ) : payouts.length === 0 ? (
          <span className="Time_Tracking_Message">{t('timeTracking.noPayouts')}</span>
        ) : (
          <div className="Table_Wrap">
            <table className="Table">
              <thead>
                <tr>
                  <th>{t('timeTracking.settlePaidAt')}</th>
                  <th>{t('timeTracking.person')}</th>
                  <th className="Right">{t('timeTracking.hours')}</th>
                  <th className="Right">{t('timeTracking.settleNetShort')}</th>
                  <th>{t('timeTracking.settleCheck')}</th>
                  {canManage && <th />}
                </tr>
              </thead>
              <tbody>
                {payouts.map((payout) => (
                  <tr key={payout.id}>
                    <td className="Num">{day(payout.paidAt)}</td>
                    <td>
                      {payout.person.name}
                      {payout.note && <div className="Time_Tracking_Sub">{payout.note}</div>}
                    </td>
                    <td className="Right Num">
                      {formatDuration(payout.seconds)}
                      <div className="Time_Tracking_Sub">{formatIn(payout.hourlyRate, payout.currency.shortCode)}/h</div>
                    </td>
                    <td className="Right Num">
                      {formatIn(payout.netAmount, payout.currency.shortCode)}
                      {payout.companyPayment && <div className="Time_Tracking_Sub">{t('timeTracking.recordedInCompany')}</div>}
                    </td>
                    <td>
                      <span className={`Pill ${CHECK_TONE[payout.check]}`}>{t(`timeTracking.payoutCheck_${payout.check}`)}</span>
                    </td>
                    {canManage && (
                      <td className="Right">
                        <button type="button" className="Time_Tracking_Link" onClick={() => setUndoing(payout)}>
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
          title={t('timeTracking.unpayoutTitle')}
          subtitle={undoing.person.name}
          message={t(undoing.companyPayment ? 'timeTracking.unpayoutMessageWithPayment' : 'timeTracking.unpayoutMessage')}
          confirmText={t('timeTracking.unsettle')}
          busy={saving}
          onClose={() => setUndoing(null)}
          onConfirm={undo}
        />
      )}
    </div>
  );
};

export default Time_Payouts_Card;

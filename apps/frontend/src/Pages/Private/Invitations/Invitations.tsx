import { useState } from 'react';
import { useNavigate } from 'react-router';
import { useTranslation } from 'react-i18next';
import { useAlert } from '../../../Contexts/Alert_Context';
import { getErrorMessage } from '../../../Hooks/useAsyncRequest';
import { useCurrencyFormat } from '../../../Hooks/useCurrencyFormat';
import { invitationsApi, useInvitations, type Payment_Check } from '../../../Hooks/System/useInvitations';
import { formatDuration } from '../../../Hooks/Companies/useTimeTracking';
import Simple_Button from '../../../Components/Buttons/Simple_Button/Simple_Button';
import Global_Input from '../../../Components/Inputs/Global_Input/Global_Input';
import './Invitations.scss';
import { localeOf } from '../../../utils/locale';
import { memberPeriodLabel } from '../Finances/Earnings/earningsLabels';

const CHECK_TONE: Record<Payment_Check, string> = { awaiting: 'Info', confirmed: 'Ok', different: 'Bad' };

/**
 * O que as empresas pedem a esta pessoa: os convites para entrar, as propostas de salário ou
 * recibo verde e os pagamentos que lhe registaram, cada um cruzado com os ganhos dela (por
 * confirmar, confirmado, valores diferentes). Confirmar um pagamento cria o ganho já preenchido.
 */
const Invitations = () => {
  const { t, i18n } = useTranslation();
  const navigate = useNavigate();
  const { setAlert } = useAlert();
  const { formatIn } = useCurrencyFormat();
  const locale = localeOf(i18n.language);
  const { data, error, reload } = useInvitations();
  const [busy, setBusy] = useState<string | null>(null);
  const [notes, setNotes] = useState<Record<string, string>>({});

  const day = (value: string | null) =>
    value
      ? new Date(`${value.slice(0, 10)}T00:00:00Z`).toLocaleDateString(locale, {
          day: '2-digit',
          month: 'short',
          year: 'numeric',
          timeZone: 'UTC',
        })
      : '—';

  const act = async (id: string, action: () => Promise<unknown>, message: string, after?: () => void) => {
    setBusy(id);
    try {
      await action();
      setAlert({ open: true, type: 'success', message });
      await reload();
      after?.();
    } catch (reason) {
      setAlert({ open: true, type: 'error', message: getErrorMessage(reason) });
    } finally {
      setBusy(null);
    }
  };

  const pending = data ? data.invites.length + data.proposals.length + data.payments.filter((p) => p.check === 'awaiting').length : 0;

  return (
    <div className="Invitations">
      <div className="Page_Head">
        <div>
          <h1>{t('invitations.title')}</h1>
          <div className="Page_Head_Sub">
            {data ? (pending ? t('invitations.pending', { count: pending }) : t('invitations.nothingPending')) : ''}
          </div>
        </div>
      </div>
      {error && <span className="Invitations_Message Bad">{error}</span>}

      <div className="Card">
        <div className="Card_Header">
          <div className="Card_Header_Text">
            <span className="Card_Title">{t('invitations.invitesTitle')}</span>
            <span className="Card_Subtitle">{t('invitations.invitesSubtitle')}</span>
          </div>
        </div>
        <div className="Invitations_Body">
          {!data ? (
            <span className="Invitations_Message">{error ? t('invitations.loadFailed') : t('common.loading')}</span>
          ) : data.invites.length === 0 ? (
            <span className="Invitations_Message">{t('invitations.noInvites')}</span>
          ) : (
            data.invites.map((invite) => (
              <div key={invite.id} className="Invitations_Row">
                <div className="Invitations_Text">
                  <span className="Invitations_Strong">{invite.company.name}</span>
                  <span className="Invitations_Sub">
                    {[
                      invite.roleName ? t('invitations.role', { role: invite.roleName }) : t('invitations.noRole'),
                      invite.invitedBy ? t('invitations.invitedBy', { name: invite.invitedBy }) : null,
                      invite.invitedAt ? day(invite.invitedAt) : null,
                    ]
                      .filter(Boolean)
                      .join(' · ')}
                  </span>
                </div>
                <div className="Invitations_Actions">
                  <Simple_Button
                    text={t('invitations.decline')}
                    variant="Ghost"
                    auto
                    disabled={busy === invite.id}
                    onClick={() => act(invite.id, () => invitationsApi.respondInvite(invite.id, false), t('invitations.declined'))}
                  />
                  <Simple_Button
                    text={t('invitations.accept')}
                    auto
                    disabled={busy === invite.id}
                    onClick={() =>
                      act(invite.id, () => invitationsApi.respondInvite(invite.id, true), t('invitations.joined'), () =>
                        navigate(`/Companies/${invite.company.slug}`),
                      )
                    }
                  />
                </div>
              </div>
            ))
          )}
        </div>
      </div>

      <div className="Card">
        <div className="Card_Header">
          <div className="Card_Header_Text">
            <span className="Card_Title">{t('invitations.proposalsTitle')}</span>
            <span className="Card_Subtitle">{t('invitations.proposalsSubtitle')}</span>
          </div>
        </div>
        <div className="Invitations_Body">
          {!data ? (
            <span className="Invitations_Message">{error ? t('invitations.loadFailed') : t('common.loading')}</span>
          ) : data.proposals.length === 0 ? (
            <span className="Invitations_Message">{t('invitations.noProposals')}</span>
          ) : (
            data.proposals.map((proposal) => (
              <div key={proposal.id} className="Invitations_Row Stack">
                <div className="Invitations_Text">
                  <span className="Invitations_Strong">
                    {proposal.company.name} · {t(`invitations.kind_${proposal.kind}`)}
                  </span>
                  <span className="Invitations_Figure Num">
                    {formatIn(proposal.grossAmount, proposal.currency)}
                    <span className="Invitations_Sub">
                      {' '}
                      {proposal.kind === 'salary'
                        ? t('invitations.perMonth', { times: proposal.paymentsPerYear ?? 12 })
                        : t('invitations.once')}
                    </span>
                  </span>
                  <span className="Invitations_Sub">
                    {[
                      proposal.kind === 'salary'
                        ? t('invitations.from', { date: day(proposal.startDate) })
                        : t('invitations.due', { date: day(proposal.dueDate) }),
                      proposal.withholdingPct !== null ? t('invitations.withholding', { pct: proposal.withholdingPct }) : null,
                      proposal.previous
                        ? t('invitations.replaces', { amount: formatIn(proposal.previous.grossAmount, proposal.currency) })
                        : null,
                      proposal.proposedBy ? t('invitations.proposedBy', { name: proposal.proposedBy }) : null,
                    ]
                      .filter(Boolean)
                      .join(' · ')}
                  </span>
                  {proposal.description && <span className="Invitations_Sub">{proposal.description}</span>}
                </div>
                <div className="Invitations_Actions">
                  <Global_Input
                    id={`proposal-note-${proposal.id}`}
                    value={notes[proposal.id] ?? ''}
                    placeholder={t('invitations.notePlaceholder')}
                    onChange={(event) => setNotes((current) => ({ ...current, [proposal.id]: event.target.value }))}
                  />
                  <Simple_Button
                    text={t('invitations.decline')}
                    variant="Ghost"
                    auto
                    disabled={busy === proposal.id}
                    onClick={() =>
                      act(
                        proposal.id,
                        () => invitationsApi.respondProposal(proposal.id, false, notes[proposal.id]),
                        t('invitations.proposalDeclined'),
                      )
                    }
                  />
                  <Simple_Button
                    text={t('invitations.accept')}
                    auto
                    disabled={busy === proposal.id}
                    onClick={() =>
                      act(
                        proposal.id,
                        () => invitationsApi.respondProposal(proposal.id, true, notes[proposal.id]),
                        t('invitations.proposalAccepted'),
                      )
                    }
                  />
                </div>
              </div>
            ))
          )}
        </div>
      </div>

      <div className="Card">
        <div className="Card_Header">
          <div className="Card_Header_Text">
            <span className="Card_Title">{t('invitations.paymentsTitle')}</span>
            <span className="Card_Subtitle">{t('invitations.paymentsSubtitle')}</span>
          </div>
        </div>
        <div className="Invitations_Body">
          {!data ? (
            <span className="Invitations_Message">{error ? t('invitations.loadFailed') : t('common.loading')}</span>
          ) : data.payments.length === 0 ? (
            <span className="Invitations_Message">{t('invitations.noPayments')}</span>
          ) : (
            <div className="Table_Wrap">
              <table className="Table">
                <thead>
                  <tr>
                    <th>{t('invitations.date')}</th>
                    <th>{t('invitations.company')}</th>
                    <th>{t('invitations.what')}</th>
                    <th className="Right">{t('invitations.paidByCompany')}</th>
                    <th className="Right">{t('invitations.inYourIncome')}</th>
                    <th>{t('invitations.check')}</th>
                    <th />
                  </tr>
                </thead>
                <tbody>
                  {data.payments.map((payment) => (
                    <tr key={`${payment.source}:${payment.id}`}>
                      <td className="Num">{day(payment.date)}</td>
                      <td>{payment.company.name}</td>
                      <td>
                        {payment.source === 'time_tracking'
                          ? t('invitations.hoursFor', { client: payment.description, hours: formatDuration(payment.seconds ?? 0) })
                          : payment.kind
                            ? t(`invitations.kind_${payment.kind}`)
                            : (payment.description ?? '—')}
                        {payment.period && <div className="Invitations_Sub">{memberPeriodLabel(t, locale, payment.period)}</div>}
                      </td>
                      <td className="Right Num">{formatIn(payment.amount, payment.currency)}</td>
                      <td className="Right Num">
                        {payment.incomeAmount === null ? '—' : formatIn(payment.incomeAmount, payment.currency)}
                      </td>
                      <td>
                        <span className={`Pill ${CHECK_TONE[payment.check]}`}>{t(`invitations.check_${payment.check}`)}</span>
                      </td>
                      <td className="Right">
                        {payment.check === 'awaiting' && (
                          <div className="Invitations_Actions">
                            <Simple_Button
                              text={t('invitations.notReceived')}
                              variant="Ghost"
                              auto
                              disabled={busy === payment.id}
                              onClick={() =>
                                act(
                                  payment.id,
                                  () => invitationsApi.confirmPayment(payment.source, payment.id, false),
                                  t('invitations.reportedNotReceived'),
                                )
                              }
                            />
                            <Simple_Button
                              text={t('invitations.received')}
                              auto
                              disabled={busy === payment.id}
                              onClick={() =>
                                act(
                                  payment.id,
                                  () => invitationsApi.confirmPayment(payment.source, payment.id, true),
                                  t('invitations.confirmed'),
                                )
                              }
                            />
                          </div>
                        )}
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          )}
        </div>
      </div>
    </div>
  );
};

export default Invitations;

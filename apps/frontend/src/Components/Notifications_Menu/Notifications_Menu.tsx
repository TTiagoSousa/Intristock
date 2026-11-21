import { useEffect, useRef, useState } from 'react';
import { useNavigate } from 'react-router';
import { useTranslation } from 'react-i18next';
import { useNotifications } from '../../Hooks/System/useNotifications';
import type { App_Notification } from '../../Hooks/System/useNotifications';
import { invitationsApi } from '../../Hooks/System/useInvitations';
import { useCurrencyFormat } from '../../Hooks/useCurrencyFormat';
import { useAlert } from '../../Contexts/Alert_Context';
import { getErrorMessage } from '../../Hooks/useAsyncRequest';
import * as Icon from '../../Imports/icons';
import './Notifications_Menu.scss';
import { localeOf } from '../../utils/locale';

/**
 * O sino no topo: quantos avisos estão por ler e, ao abrir, os mais recentes.
 * Clicar num aviso marca-o como lido e abre a página dele (as novidades de uma
 * versão, por exemplo). Os que pedem resposta (um convite, uma proposta de salário,
 * um pagamento a confirmar) têm os botões por baixo enquanto estão `pending`.
 */
const Notifications_Menu = () => {
  const { t, i18n } = useTranslation();
  const navigate = useNavigate();
  const { items, unread, markRead, markAllRead, reload } = useNotifications();
  const { formatIn } = useCurrencyFormat();
  const { setAlert } = useAlert();
  const [busy, setBusy] = useState<string | null>(null);
  const [open, setOpen] = useState(false);
  const ref = useRef<HTMLDivElement>(null);

  useEffect(() => {
    if (!open) return;
    const close = (event: MouseEvent) => {
      if (ref.current && !ref.current.contains(event.target as Node)) setOpen(false);
    };
    const escape = (event: KeyboardEvent) => {
      if (event.key === 'Escape') setOpen(false);
    };
    document.addEventListener('mousedown', close);
    document.addEventListener('keydown', escape);
    return () => {
      document.removeEventListener('mousedown', close);
      document.removeEventListener('keydown', escape);
    };
  }, [open]);

  const choose = (item: App_Notification) => {
    if (!item.readAt) void markRead(item.id);
    setOpen(false);
    if (item.link) navigate(item.link);
  };

  // Os números do aviso para o texto: o valor já formatado na moeda dele
  const params = (item: App_Notification) => {
    const data = item.data;
    return {
      ...data,
      amount:
        typeof data.amount === 'number' ? formatIn(data.amount, String(data.currency ?? 'EUR')) : data.amount,
      grossAmount:
        typeof data.grossAmount === 'number' ? formatIn(data.grossAmount, String(data.currency ?? 'EUR')) : data.grossAmount,
    };
  };

  // As respostas têm duas versões do texto (aceitou/recusou, recebeu/não recebeu)
  const variant = (item: App_Notification) =>
    typeof item.data.accepted === 'boolean'
      ? item.data.accepted
        ? '_accepted'
        : '_declined'
      : typeof item.data.received === 'boolean'
        ? item.data.received
          ? '_received'
          : '_missing'
        : '';

  const respond = async (item: App_Notification, yes: boolean) => {
    const data = item.data;
    setBusy(item.id);
    try {
      if (item.kind === 'company_invite') await invitationsApi.respondInvite(String(data.memberId), yes);
      else if (item.kind === 'member_pay_proposed') await invitationsApi.respondProposal(String(data.payId), yes);
      else if (item.kind === 'member_paid')
        await invitationsApi.confirmPayment(
          data.source === 'time_tracking' ? 'time_tracking' : 'company_payment',
          String(data.source === 'time_tracking' ? data.payoutId : data.paymentId),
          yes,
        );
      await reload();
    } catch (reason) {
      setAlert({ open: true, type: 'error', message: getErrorMessage(reason) });
    } finally {
      setBusy(null);
    }
  };

  const actions = (item: App_Notification) =>
    item.kind === 'member_paid'
      ? [t('notifications.actionNotReceived'), t('notifications.actionReceived')]
      : [t('notifications.actionDecline'), t('notifications.actionAccept')];

  const when = (iso: string) =>
    new Date(iso).toLocaleString(localeOf(i18n.language), { day: '2-digit', month: 'short', hour: '2-digit', minute: '2-digit' });

  const label = unread ? t('notifications.openUnread', { count: unread }) : t('notifications.open');

  return (
    <div className="Notifications_Menu" ref={ref}>
      <button
        type="button"
        className="Icon_Button Notifications_Bell"
        onClick={() => setOpen((value) => !value)}
        aria-label={label}
        aria-expanded={open}
        title={label}
      >
        <Icon.Bell />
        {unread > 0 && <span className="Notifications_Badge">{unread > 9 ? '9+' : unread}</span>}
      </button>

      {open && (
        <div className="Notifications_Dropdown" role="dialog" aria-label={t('notifications.title')}>
          <div className="Notifications_Head">
            <span className="Notifications_Title">{t('notifications.title')}</span>
            {unread > 0 && (
              <button type="button" className="Notifications_Read_All" onClick={() => void markAllRead()}>
                {t('notifications.markAll')}
              </button>
            )}
          </div>

          {items.length === 0 ? (
            <span className="Notifications_Empty">{t('notifications.empty')}</span>
          ) : (
            <ul className="Notifications_List">
              {items.map((item) => (
                <li key={item.id}>
                  <button
                    type="button"
                    className={`Notifications_Item${item.readAt ? '' : ' Unread'}`}
                    onClick={() => choose(item)}
                  >
                    <span className="Notifications_Dot" aria-hidden="true" />
                    <span className="Notifications_Text">
                      <span className="Notifications_Item_Title">
                        {t(`notifications.${item.kind}${variant(item)}_title`, params(item))}
                      </span>
                      <span className="Notifications_Item_Body">
                        {t(`notifications.${item.kind}${variant(item)}_body`, params(item))}
                      </span>
                      <span className="Notifications_Item_Time">
                        {when(item.createdAt)}
                        {item.actionStatus && item.actionStatus !== 'pending'
                          ? ` · ${t(`notifications.status_${item.actionStatus}`)}`
                          : ''}
                      </span>
                    </span>
                  </button>
                  {item.actionStatus === 'pending' && (
                    <div className="Notifications_Actions">
                      <button
                        type="button"
                        className="Notifications_Action"
                        disabled={busy === item.id}
                        onClick={() => void respond(item, false)}
                      >
                        {actions(item)[0]}
                      </button>
                      <button
                        type="button"
                        className="Notifications_Action Primary"
                        disabled={busy === item.id}
                        onClick={() => void respond(item, true)}
                      >
                        {actions(item)[1]}
                      </button>
                    </div>
                  )}
                </li>
              ))}
            </ul>
          )}
          <button
            type="button"
            className="Notifications_Footer"
            onClick={() => {
              setOpen(false);
              navigate('/Convites');
            }}
          >
            {t('notifications.openInvitations')}
          </button>
        </div>
      )}
    </div>
  );
};

export default Notifications_Menu;

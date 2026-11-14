import { useEffect, useRef, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { useTranslation } from 'react-i18next';
import { useNotifications } from '../../Hooks/System/useNotifications';
import type { App_Notification } from '../../Hooks/System/useNotifications';
import * as Icon from '../../Imports/icons';
import './Notifications_Menu.scss';

/**
 * O sino no topo: quantos avisos estão por ler e, ao abrir, os mais recentes.
 * Clicar num aviso marca-o como lido e abre a página dele (as novidades de uma
 * versão, por exemplo).
 */
const Notifications_Menu = () => {
  const { t, i18n } = useTranslation();
  const navigate = useNavigate();
  const { items, unread, markRead, markAllRead } = useNotifications();
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

  const when = (iso: string) =>
    new Date(iso).toLocaleString(i18n.language, { day: '2-digit', month: 'short', hour: '2-digit', minute: '2-digit' });

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
                        {t(`notifications.${item.kind}_title`, { ...item.data })}
                      </span>
                      <span className="Notifications_Item_Body">
                        {t(`notifications.${item.kind}_body`, { ...item.data })}
                      </span>
                      <span className="Notifications_Item_Time">{when(item.createdAt)}</span>
                    </span>
                  </button>
                </li>
              ))}
            </ul>
          )}
        </div>
      )}
    </div>
  );
};

export default Notifications_Menu;

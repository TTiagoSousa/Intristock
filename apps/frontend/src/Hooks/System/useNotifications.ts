import { useCallback, useEffect, useState } from 'react';
import http from '../../Service/httpService';
import { End_Points } from '../../Service/endPoints';
import { useVisibleInterval } from '../useVisibleInterval';
import { INVITATIONS_CHANGED_EVENT } from './useInvitations';

// version_installed (entrou uma versão nova) | version_available (há uma para instalar, só admins);
// os convites, as propostas de salário e os pagamentos a confirmar (ver o backend)
export type Notification_Kind =
  | 'version_installed'
  | 'version_available'
  | 'backup_failed'
  | 'company_invite'
  | 'company_invite_answered'
  | 'member_pay_proposed'
  | 'member_pay_answered'
  | 'member_paid'
  | 'member_payment_confirmed';

// Num aviso que pede resposta: pending até se responder
export type Notification_Action_Status = 'pending' | 'accepted' | 'declined' | 'cancelled' | 'done';

// Um aviso: o texto faz-se no ecrã a partir do kind e dos números em data
export interface App_Notification {
  id: string;
  kind: Notification_Kind;
  data: Record<string, string | number | boolean | null>;
  link: string | null;
  actionStatus: Notification_Action_Status | null;
  readAt: string | null;
  createdAt: string;
}

// Os avisos novos veem-se de tanto em tanto tempo
const REFRESH_MS = 60_000;

/** Os avisos do utilizador (o sino no topo): a lista, os por ler e marcar como lidos. */
export const useNotifications = () => {
  const [items, setItems] = useState<App_Notification[]>([]);
  const [unread, setUnread] = useState(0);

  const load = useCallback(async () => {
    try {
      const { data } = await http.get<{ items: App_Notification[]; unread: number }>(
        End_Points.Notifications_Endpoint(),
      );
      setItems(data.items);
      setUnread(data.unread);
    } catch {
      // Sem rede fica o que já havia
    }
  }, []);

  // Ao abrir, e depois de tanto em tanto tempo só com o separador à vista
  useEffect(() => {
    void load();
  }, [load]);
  useVisibleInterval(load, REFRESH_MS);

  // Respondeu-se a um convite ou proposta noutro sítio (a página «Convites»): os
  // botões do sino deixam de estar ativos
  useEffect(() => {
    const onChanged = () => void load();
    window.addEventListener(INVITATIONS_CHANGED_EVENT, onChanged);
    return () => window.removeEventListener(INVITATIONS_CHANGED_EVENT, onChanged);
  }, [load]);

  // Otimista: fica lido logo no ecrã, e o número certo vem do backend
  const markRead = async (id: string) => {
    const now = new Date().toISOString();
    setItems((list) => list.map((item) => (item.id === id && !item.readAt ? { ...item, readAt: now } : item)));
    setUnread((count) => Math.max(0, count - (items.some((item) => item.id === id && !item.readAt) ? 1 : 0)));
    try {
      const { data } = await http.post<{ unread: number }>(End_Points.Notification_Read_Endpoint(id));
      setUnread(data.unread);
    } catch {
      await load();
    }
  };

  const markAllRead = async () => {
    const now = new Date().toISOString();
    setItems((list) => list.map((item) => (item.readAt ? item : { ...item, readAt: now })));
    setUnread(0);
    try {
      await http.post(End_Points.Notifications_Read_All_Endpoint());
    } catch {
      await load();
    }
  };

  return { items, unread, markRead, markAllRead, reload: load };
};

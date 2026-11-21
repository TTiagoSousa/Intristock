import { useState } from 'react';
import { useTranslation } from 'react-i18next';
import { isUserBlocked, useUsers, type Managed_User } from '../../../../../Hooks/Admin/useUsers';
import { useAuth } from '../../../../../Contexts/Auth_Context';
import Simple_Button from '../../../../../Components/Buttons/Simple_Button/Simple_Button';
import Create_User_Popover from './Create_User_Popover';
import Block_User_Popover from './Block_User_Popover';
import Delete_User_Popover from './Delete_User_Popover';
import * as Icon from '../../../../../Imports/icons';
import '../Admin.scss';
import { localeOf } from '../../../../../utils/locale';

const Users = () => {
  const { t, i18n } = useTranslation();
  const { user: me } = useAuth();
  const { users, loading, saving, createUser, updateUser, deleteUser, blockUser, unblockUser } = useUsers();
  // O formulário: null fechado, 'new' a criar, ou o utilizador a editar
  const [form, setForm] = useState<Managed_User | 'new' | null>(null);
  const [toBlock, setToBlock] = useState<Managed_User | null>(null);
  const [toDelete, setToDelete] = useState<Managed_User | null>(null);

  const locale = localeOf(i18n.language);
  const formatDate = (iso: string) => new Date(iso).toLocaleDateString(locale);
  const formatDateTime = (iso: string) =>
    new Date(iso).toLocaleString(locale, { dateStyle: 'short', timeStyle: 'short' });

  return (
    <div className="Admin_Page">
      <div className="Page_Head">
        <div>
          <h1>{t('adminUsers.title')}</h1>
          <div className="Page_Head_Sub">{t('adminUsers.subtitle')}</div>
        </div>
      </div>

      <div className="Card Admin_Block Full">
        <div className="Card_Header">
          <div className="Card_Header_Text">
            <span className="Card_Title">{t('adminUsers.title')}</span>
            <span className="Card_Subtitle">{users.length}</span>
          </div>
          <div className="Card_Header_Action">
            <Simple_Button text={t('adminUsers.new')} onClick={() => setForm('new')} />
          </div>
        </div>
        {loading ? (
          <span className="Admin_Message">{t('common.loading')}</span>
        ) : (
          <div className="Admin_Block_Body">
            <div className="Table_Wrap">
              <table className="Table">
                <thead>
                  <tr>
                    <th>{t('adminUsers.name')}</th>
                    <th>{t('adminUsers.email')}</th>
                    <th>{t('adminUsers.role')}</th>
                    <th>{t('adminUsers.status')}</th>
                    <th>{t('adminUsers.createdAt')}</th>
                    <th></th>
                  </tr>
                </thead>
                <tbody>
                  {users.map((user) => {
                    const blocked = isUserBlocked(user);
                    const isMe = user.id === me?.id;
                    return (
                      <tr key={user.id}>
                        <td>{user.fullName}</td>
                        <td className="Num">{user.email}</td>
                        <td>
                          <span className={`Pill ${user.role === 'ADMIN' ? 'Info' : ''}`}>
                            {t(`adminUsers.roles.${user.role}`)}
                          </span>
                        </td>
                        <td>
                          {blocked && user.blockedUntil ? (
                            <span className="Pill Bad" title={user.blockedReason ?? undefined}>
                              <span className="Dot" />
                              {t('adminUsers.blockedUntil', { date: formatDateTime(user.blockedUntil) })}
                            </span>
                          ) : (
                            <span className={`Pill ${user.active ? 'Ok' : ''}`}>
                              <span className="Dot" />
                              {user.active ? t('adminUsers.active') : t('adminUsers.inactive')}
                            </span>
                          )}
                        </td>
                        <td className="Num Admin_Nowrap">{formatDate(user.createdAt)}</td>
                        <td className="Right">
                          <div className="Row_Actions">
                            <button
                              type="button"
                              className="Row_Action"
                              onClick={() => setForm(user)}
                              title={t('common.edit')}
                              aria-label={t('common.edit')}
                            >
                              <Icon.Edit />
                            </button>
                            {/* Ninguém se bloqueia nem se apaga a si próprio */}
                            {!isMe && (
                              <button
                                type="button"
                                className={`Row_Action ${blocked ? 'Active' : ''}`}
                                onClick={() => (blocked ? unblockUser(user.id) : setToBlock(user))}
                                title={t(blocked ? 'adminUsers.unblock' : 'adminUsers.block')}
                                aria-label={t(blocked ? 'adminUsers.unblock' : 'adminUsers.block')}
                                disabled={saving}
                              >
                                <Icon.Ban />
                              </button>
                            )}
                            {!isMe && (
                              <button
                                type="button"
                                className="Row_Action Danger"
                                onClick={() => setToDelete(user)}
                                title={t('common.delete')}
                                aria-label={t('common.delete')}
                              >
                                <Icon.Trash />
                              </button>
                            )}
                          </div>
                        </td>
                      </tr>
                    );
                  })}
                </tbody>
              </table>
            </div>
          </div>
        )}
      </div>

      {form && (
        <Create_User_Popover
          saving={saving}
          user={form === 'new' ? undefined : form}
          onClose={() => setForm(null)}
          onCreate={createUser}
          onUpdate={updateUser}
        />
      )}

      {toBlock && (
        <Block_User_Popover
          user={toBlock}
          saving={saving}
          onClose={() => setToBlock(null)}
          onConfirm={(until, reason) => blockUser(toBlock.id, until, reason)}
        />
      )}

      {toDelete && (
        <Delete_User_Popover
          user={toDelete}
          saving={saving}
          onClose={() => setToDelete(null)}
          onConfirm={async () => {
            if (await deleteUser(toDelete.id)) setToDelete(null);
          }}
        />
      )}
    </div>
  );
};

export default Users;

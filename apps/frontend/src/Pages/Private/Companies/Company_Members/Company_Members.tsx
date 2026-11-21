import { useState } from 'react';
import { useNavigate, useParams } from 'react-router';
import { useTranslation } from 'react-i18next';
import { useCompany } from '../../../../Contexts/Company_Context';
import { useAuth } from '../../../../Contexts/Auth_Context';
import { useBreadcrumbSegmentLabel } from '../../../../Contexts/Breadcrumb_Context';
import { useCompanyAccessAdmin, type Company_Member } from '../../../../Hooks/Companies/useCompanyAccessAdmin';
import Simple_Button from '../../../../Components/Buttons/Simple_Button/Simple_Button';
import Member_Popover from './Member_Popover';
import Confirm_Popover from '../../../../Components/Confirm_Popover/Confirm_Popover';
import * as Icon from '../../../../Imports/icons';
import './Company_Members.scss';
import { activateOnKey } from '../../../../utils/rowKeyboard';

/**
 * Quem trabalha na empresa: o dono (tudo) e os membros — com conta (entram na
 * app, com um cargo e os ajustes dele) ou sem conta (só um registo, para os
 * salários, os contratos e os dados). Cada linha abre a página do membro; o
 * lápis muda o acesso de quem tem conta. Ninguém se muda a si próprio.
 */
const Company_Members = () => {
  const { slug } = useParams();
  const navigate = useNavigate();
  const { t } = useTranslation();
  const { user } = useAuth();
  const { company, can, loading: loadingCompany } = useCompany();
  const { catalog, roles, members, loading, saving, addMember, updateMember, removeMember } =
    useCompanyAccessAdmin(company?.id);
  // undefined = fechado, null = adicionar
  const [editing, setEditing] = useState<Company_Member | null | undefined>(undefined);
  const [toRemove, setToRemove] = useState<Company_Member | null>(null);

  useBreadcrumbSegmentLabel(slug, company?.name);

  const manage = can('members.manage');

  if (loadingCompany || !company) {
    return (
      <div className="Company_Members">
        <span className="Company_Members_Message">
          {loadingCompany ? t('common.loading') : t('companies.notFound')}
        </span>
      </div>
    );
  }

  return (
    <div className="Company_Members">
      <div className="Card Company_Members_Card">
        <div className="Card_Header">
          <div className="Card_Header_Text">
            <span className="Card_Title">{t('companyMembers.title')}</span>
            <span className="Card_Subtitle">{t('companyMembers.subtitle')}</span>
          </div>
          {manage && (
            <div className="Card_Header_Action">
              <Simple_Button text={t('companyMembers.addButton')} onClick={() => setEditing(null)} small auto />
            </div>
          )}
        </div>

        {loading ? (
          <span className="Company_Members_Message">{t('common.loading')}</span>
        ) : (
          <div className="Company_Members_Body">
          <div className="Table_Wrap">
            <table className="Table">
              <thead>
                <tr>
                  <th className="Col_Name">{t('companyMembers.name')}</th>
                  <th className="Col_Role">{t('companyMembers.role')}</th>
                  <th>{t('companyMembers.adjustments')}</th>
                  <th className="Col_Actions" />
                </tr>
              </thead>
              <tbody>
                {members.owner && (
                  <tr>
                    <td>
                      <span className="Member_Name">{members.owner.fullName}</span>
                      <div className="Member_Sub">{members.owner.email}</div>
                    </td>
                    <td>
                      <span className="Pill Gold">{t('companyMembers.owner')}</span>
                    </td>
                    <td>
                      <span className="Member_Sub">{t('companyMembers.ownerHint')}</span>
                    </td>
                    <td />
                  </tr>
                )}
                {members.members.map((member) => {
                  const isMe = member.user?.id === user?.id;
                  const canEdit = manage && !isMe;
                  return (
                    <tr
                      key={member.id}
                      className="Clickable"
                      onClick={() => navigate(`/Companies/${company.slug}/membros/pessoa/${member.id}`)} tabIndex={0} onKeyDown={activateOnKey}
                    >
                      <td>
                        <span className="Member_Name">{member.name}</span>
                        <div className="Member_Sub">
                          {[member.jobTitle, member.email].filter(Boolean).join(' · ')}
                        </div>
                      </td>
                      <td>
                        {!member.user ? (
                          <span className="Pill">{t('companyMembers.noAccount')}</span>
                        ) : member.status !== 'active' ? (
                          <span className={`Pill ${member.status === 'invited' ? 'Warn' : 'Bad'}`}>
                            {t(`companyMembers.status_${member.status}`)}
                          </span>
                        ) : member.role ? (
                          <span className="Pill Info">{member.role.name}</span>
                        ) : (
                          <span className="Member_Sub">{t('companyMembers.noRole')}</span>
                        )}
                      </td>
                      <td>
                        {member.extraPermissions.length + member.deniedPermissions.length === 0 ? (
                          <span className="Member_Sub">—</span>
                        ) : (
                          <span className="Member_Adjustments Num">
                            {member.extraPermissions.length > 0 && (
                              <span className="Extra">+{member.extraPermissions.length}</span>
                            )}
                            {member.deniedPermissions.length > 0 && (
                              <span className="Denied">−{member.deniedPermissions.length}</span>
                            )}
                          </span>
                        )}
                      </td>
                      <td className="Right">
                        {canEdit && (
                          <div className="Row_Actions">
                            {member.user && (
                              <button
                                type="button"
                                className="Row_Action"
                                onClick={(e) => {
                                  e.stopPropagation();
                                  setEditing(member);
                                }}
                                title={t('companyMembers.editAccess')}
                                aria-label={t('companyMembers.editAccess')}
                              >
                                <Icon.Edit />
                              </button>
                            )}
                            <button
                              type="button"
                              className="Row_Action Danger"
                              onClick={(e) => {
                                e.stopPropagation();
                                setToRemove(member);
                              }}
                              title={t('companyMembers.remove')}
                              aria-label={t('companyMembers.remove')}
                            >
                              <Icon.Trash />
                            </button>
                          </div>
                        )}
                      </td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </div>
            {members.members.length === 0 && (
              <div className="Empty_State Company_Members_Empty">
                <span className="Empty_State_Title">{t('companyMembers.empty')}</span>
                <span className="Empty_State_Text">{t('companyMembers.emptyHint')}</span>
              </div>
            )}
          </div>
        )}
      </div>

      {editing !== undefined && (
        <Member_Popover
          catalog={catalog}
          roles={roles}
          member={editing}
          saving={saving}
          readOnly={!manage || (!!editing && editing.user?.id === user?.id)}
          onClose={() => setEditing(undefined)}
          onAdd={async (input) => {
            if (await addMember(input)) setEditing(undefined);
          }}
          onUpdate={async (update) => {
            if (editing && (await updateMember(editing.id, update))) setEditing(undefined);
          }}
        />
      )}

      {toRemove && (
        <Confirm_Popover
          title={t('companyMembers.removeTitle')}
          subtitle={toRemove.email ?? ''}
          message={t(toRemove.user ? 'companyMembers.removeConfirm' : 'companyMembers.removeRecordConfirm', {
            name: toRemove.name,
          })}
          confirmText={t('companyMembers.remove')}
          busy={saving}
          onClose={() => setToRemove(null)}
          onConfirm={async () => {
            if (await removeMember(toRemove.id)) setToRemove(null);
          }}
        />
      )}
    </div>
  );
};

export default Company_Members;

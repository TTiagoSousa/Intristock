import { useState } from 'react';
import { useParams } from 'react-router';
import { useTranslation } from 'react-i18next';
import { useCompany } from '../../../../Contexts/Company_Context';
import { useBreadcrumbSegmentLabel } from '../../../../Contexts/Breadcrumb_Context';
import { useCompanyAccessAdmin, type Company_Role } from '../../../../Hooks/Companies/useCompanyAccessAdmin';
import Simple_Button from '../../../../Components/Buttons/Simple_Button/Simple_Button';
import Role_Popover from './Role_Popover';
import Confirm_Popover from '../../../../Components/Confirm_Popover/Confirm_Popover';
import * as Icon from '../../../../Imports/icons';
import './Company_Members.scss';
import { activateOnKey } from '../../../../utils/rowKeyboard';

/**
 * Os cargos da empresa: cada um com as permissões que dá. Quem tem "gerir
 * membros" cria, edita e apaga; quem só vê abre-os para ler.
 */
const Company_Roles = () => {
  const { slug } = useParams();
  const { t } = useTranslation();
  const { company, can, loading: loadingCompany } = useCompany();
  const { catalog, roles, loading, saving, createRole, updateRole, deleteRole } = useCompanyAccessAdmin(company?.id);
  // undefined = fechado, null = novo
  const [editing, setEditing] = useState<Company_Role | null | undefined>(undefined);
  const [toDelete, setToDelete] = useState<Company_Role | null>(null);

  useBreadcrumbSegmentLabel(slug, company?.name);

  const manage = can('members.manage');
  const total = catalog.reduce((sum, area) => sum + area.actions.length, 0);

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
            <span className="Card_Title">{t('companyRoles.title')}</span>
            <span className="Card_Subtitle">{t('companyRoles.subtitle')}</span>
          </div>
          {manage && (
            <div className="Card_Header_Action">
              <Simple_Button text={t('companyRoles.new')} onClick={() => setEditing(null)} small auto />
            </div>
          )}
        </div>

        {loading ? (
          <span className="Company_Members_Message">{t('common.loading')}</span>
        ) : roles.length === 0 ? (
          <div className="Company_Members_Body">
            <div className="Empty_State">
              <span className="Empty_State_Title">{t('companyRoles.empty')}</span>
              <span className="Empty_State_Text">{t('companyRoles.emptyHint')}</span>
            </div>
          </div>
        ) : (
          <div className="Company_Members_Body">
          <div className="Table_Wrap">
            <table className="Table">
              <thead>
                <tr>
                  <th className="Col_Name">{t('companyRoles.name')}</th>
                  <th className="Col_Role">{t('companyRoles.permissions')}</th>
                  <th className="Right">{t('companyRoles.members')}</th>
                  <th className="Col_Actions" />
                </tr>
              </thead>
              <tbody>
                {roles.map((role) => (
                  <tr key={role.id} className="Clickable" onClick={() => setEditing(role)} tabIndex={0} onKeyDown={activateOnKey}>
                    <td>
                      <span className="Member_Name">{role.name}</span>
                      {role.description && <div className="Member_Sub">{role.description}</div>}
                    </td>
                    <td className="Num">
                      {t('companyRoles.permissionCount', { count: role.permissions.length, total })}
                    </td>
                    <td className="Num Right">{role.memberCount}</td>
                    <td className="Right">
                      {manage && (
                        <div className="Row_Actions">
                          <button
                            type="button"
                            className="Row_Action"
                            onClick={(e) => {
                              e.stopPropagation();
                              setEditing(role);
                            }}
                            title={t('common.edit')}
                            aria-label={t('common.edit')}
                          >
                            <Icon.Edit />
                          </button>
                          <button
                            type="button"
                            className="Row_Action Danger"
                            onClick={(e) => {
                              e.stopPropagation();
                              setToDelete(role);
                            }}
                            title={t('common.delete')}
                            aria-label={t('common.delete')}
                          >
                            <Icon.Trash />
                          </button>
                        </div>
                      )}
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
          </div>
        )}
      </div>

      {editing !== undefined && (
        <Role_Popover
          catalog={catalog}
          role={editing}
          saving={saving}
          readOnly={!manage}
          onClose={() => setEditing(undefined)}
          onSave={async (input) => {
            const ok = editing ? await updateRole(editing.id, input) : await createRole(input);
            if (ok) setEditing(undefined);
          }}
        />
      )}

      {toDelete && (
        <Confirm_Popover
          title={t('companyRoles.deleteTitle')}
          subtitle={toDelete.name}
          message={t('companyRoles.deleteConfirm', { name: toDelete.name })}
          confirmText={t('common.delete')}
          busy={saving}
          onClose={() => setToDelete(null)}
          onConfirm={async () => {
            if (await deleteRole(toDelete.id)) setToDelete(null);
          }}
        />
      )}
    </div>
  );
};

export default Company_Roles;

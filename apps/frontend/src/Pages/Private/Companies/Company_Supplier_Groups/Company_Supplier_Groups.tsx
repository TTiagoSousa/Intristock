import { useState } from 'react';
import { useParams } from 'react-router-dom';
import { useTranslation } from 'react-i18next';
import { useCompanies } from '../../../../Hooks/Companies/useCompanies';
import {
  useCompanySupplierGroups,
  type CompanySupplierGroup,
} from '../../../../Hooks/Companies/useCompanySupplierGroups';
import { useBreadcrumbSegmentLabel } from '../../../../Contexts/Breadcrumb_Context';
import Simple_Button from '../../../../Components/Buttons/Simple_Button/Simple_Button';
import Global_Pagination from '../../../../Components/Pagination/Global_Pagination/Global_Pagination';
import Supplier_Group_Form_Popover from './Supplier_Group_Form_Popover';
import Group_Suppliers_Popover from './Group_Suppliers_Popover';
import Delete_Group_Popover from './Delete_Group_Popover';
import * as Icon from '../../../../Imports/icons';
import { useCompany } from '../../../../Contexts/Company_Context';
import './Company_Supplier_Groups.scss';

const Company_Supplier_Groups = () => {
  const { slug } = useParams();
  const { companies, loading: loadingCompanies } = useCompanies();
  const { can } = useCompany();
  const { t } = useTranslation();

  const company = companies.find((item) => item.slug === slug);

  useBreadcrumbSegmentLabel(slug, company?.name);

  const {
    groups,
    loading: loadingGroups,
    refresh,
    createGroup,
    updateGroup,
    deleteGroup,
    setGroupSuppliers,
    page,
    setPage,
    total,
    totalPages,
    pageSize,
  } = useCompanySupplierGroups(company?.id);

  const [expandedIds, setExpandedIds] = useState<string[]>([]);
  const [isFormOpen, setIsFormOpen] = useState(false);
  const [groupToEdit, setGroupToEdit] = useState<CompanySupplierGroup | null>(null);
  const [groupToDelete, setGroupToDelete] = useState<CompanySupplierGroup | null>(null);
  const [groupToManage, setGroupToManage] = useState<CompanySupplierGroup | null>(null);

  const toggleExpanded = (groupId: string) => {
    setExpandedIds((current) =>
      current.includes(groupId)
        ? current.filter((id) => id !== groupId)
        : [...current, groupId],
    );
  };

  if (loadingCompanies) {
    return (
      <div className="Company_Supplier_Groups">
        <span className="Groups_Message">{t('common.loading')}</span>
      </div>
    );
  }

  if (!company) {
    return (
      <div className="Company_Supplier_Groups">
        <span className="Groups_Message">{t('companies.notFound')}</span>
      </div>
    );
  }

  return (
    <div className="Company_Supplier_Groups">
      <div className="Groups_Card">
        <div className="Card_Header">
          <div className="Card_Header_Text">
            <span className="Card_Title">{t('supplierGroups.title')}</span>
            <span className="Card_Subtitle">{company.name}</span>
          </div>

          <div className="Card_Header_Action">
            {can('suppliers.create') && (
              <Simple_Button text={t('supplierGroups.addGroup')} onClick={() => setIsFormOpen(true)} />
            )}
          </div>
        </div>

        <div className="Groups_Body">
          {loadingGroups ? (
            <span className="Groups_Message">{t('common.loading')}</span>
          ) : groups.length === 0 ? (
            <span className="Groups_Message">{t('supplierGroups.empty')}</span>
          ) : (
            <>
  <div className="Groups_Table_Scroll">
                <table className="Groups_Table">
                  <thead>
                    <tr>
                      <th className="Expand_Column"></th>
                      <th>{t('supplierGroups.columnName')}</th>
                      <th>{t('supplierGroups.columnDescription')}</th>
                      <th>{t('supplierGroups.columnSuppliers')}</th>
                      <th></th>
                    </tr>
                  </thead>
                  <tbody>
                    {groups.map((group) => {
                      const isExpanded = expandedIds.includes(group.id);

                      return [
                        <tr key={group.id} className="Group_Row">
                          <td className="Expand_Column">
                            <button
                              type="button"
                              className={`Expand_Toggle${isExpanded ? ' Open' : ''}`}
                              onClick={() => toggleExpanded(group.id)}
                              aria-label={t(isExpanded ? 'supplierGroups.collapse' : 'supplierGroups.expand')}
                              disabled={group.suppliers.length === 0}
                            >
                              <Icon.Chevron_Down />
                            </button>
                          </td>
                          <td className="Group_Name">{group.name}</td>
                          <td>{group.description ?? '—'}</td>
                          <td>
                            <span className="Suppliers_Count">
                              {t('supplierGroups.suppliersCount', { count: group.suppliers.length })}
                            </span>
                          </td>
                          <td className="Right">
                            <div className="Group_Actions">
                              {can('suppliers.edit') && (
                                <button
                                  type="button"
                                  className="Row_Action"
                                  onClick={() => setGroupToManage(group)}
                                  title={t('supplierGroups.manageSuppliers')}
                                  aria-label={t('supplierGroups.manageSuppliers')}
                                >
                                  <Icon.Company />
                                </button>
                              )}
                              {can('suppliers.edit') && (
                                <button
                                  type="button"
                                  className="Row_Action"
                                  onClick={() => setGroupToEdit(group)}
                                  title={t('common.edit')}
                                  aria-label={t('common.edit')}
                                >
                                  <Icon.Edit />
                                </button>
                              )}
                              {can('suppliers.delete') && (
                                <button
                                  type="button"
                                  className="Row_Action Danger"
                                  onClick={() => setGroupToDelete(group)}
                                  title={t('common.delete')}
                                  aria-label={t('common.delete')}
                                >
                                  <Icon.Trash />
                                </button>
                              )}
                            </div>
                          </td>
                        </tr>,

                        ...(isExpanded
                          ? group.suppliers.map((supplier) => (
                              <tr key={`${group.id}-${supplier.id}`} className="Supplier_Row">
                                <td className="Expand_Column"></td>
                                <td colSpan={4} className="Supplier_Row_Name">
                                  {supplier.name}
                                </td>
                              </tr>
                            ))
                          : []),
                      ];
                    })}
                  </tbody>
                </table>
              </div>
              <Global_Pagination
                page={page}
                totalPages={totalPages}
                onPageChange={setPage}
                totalItems={total}
                pageSize={pageSize}
              />
            </>
          )}
        </div>
      </div>

      {(isFormOpen || groupToEdit) && (
        <Supplier_Group_Form_Popover
          companyName={company.name}
          group={groupToEdit ?? undefined}
          onClose={() => {
            setIsFormOpen(false);
            setGroupToEdit(null);
          }}
          onSubmit={async (payload) => {
            const saved = groupToEdit
              ? await updateGroup(groupToEdit.id, payload)
              : await createGroup(payload);

            if (saved) {
              setIsFormOpen(false);
              setGroupToEdit(null);
              refresh();
            }
          }}
        />
      )}

      {groupToManage && (
        <Group_Suppliers_Popover
          companyId={company.id}
          group={groupToManage}
          onClose={() => setGroupToManage(null)}
          onSave={async (supplierIds) => {
            const saved = await setGroupSuppliers(groupToManage.id, supplierIds);

            if (saved) {
              setGroupToManage(null);
              refresh();
            }
          }}
        />
      )}

      {groupToDelete && (
        <Delete_Group_Popover
          groupName={groupToDelete.name}
          supplierCount={groupToDelete.suppliers.length}
          onClose={() => setGroupToDelete(null)}
          onConfirm={async () => {
            const deleted = await deleteGroup(groupToDelete.id);
            if (deleted) setGroupToDelete(null);
          }}
        />
      )}
    </div>
  );
};

export default Company_Supplier_Groups;

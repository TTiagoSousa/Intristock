import { useState } from 'react';
import { useNavigate, useParams } from 'react-router-dom';
import { useTranslation } from 'react-i18next';
import { useCompanies } from '../../../../Hooks/Companies/useCompanies';
import { useCompanySuppliers } from '../../../../Hooks/Companies/useCompanySuppliers';
import { useCreateCompanySupplier } from '../../../../Hooks/Companies/useCreateCompanySupplier';
import { useBreadcrumbSegmentLabel } from '../../../../Contexts/Breadcrumb_Context';
import Simple_Button from '../../../../Components/Buttons/Simple_Button/Simple_Button';
import Global_Pagination from '../../../../Components/Pagination/Global_Pagination/Global_Pagination';
import Supplier_Form_Popover from './Supplier_Form_Popover';
import Delete_Supplier_Popover from './Delete_Supplier_Popover';
import type { CompanySupplier } from '../../../../Hooks/Companies/useCompanySuppliers';
import * as Icon from '../../../../Imports/icons';
import { useCompany } from '../../../../Contexts/Company_Context';
import './Company_Suppliers.scss';

const Company_Suppliers = () => {
  const { slug } = useParams();
  const { companies, loading: loadingCompanies } = useCompanies();
  const { can } = useCompany();
  const { t } = useTranslation();
  const [isFormOpen, setIsFormOpen] = useState(false);
  const [supplierToDelete, setSupplierToDelete] = useState<CompanySupplier | null>(null);

  const navigate = useNavigate();

  const company = companies.find((item) => item.slug === slug);
  const { deleteSupplier, loading: deleting } = useCreateCompanySupplier(company?.id);

  useBreadcrumbSegmentLabel(slug, company?.name);

  const {
    suppliers,
    loading: loadingSuppliers,
    refresh,
    page,
    setPage,
    total,
    totalPages,
    pageSize,
  } = useCompanySuppliers(company?.id);

  if (loadingCompanies) {
    return (
      <div className="Company_Suppliers">
        <span className="Company_Suppliers_Message">{t('common.loading')}</span>
      </div>
    );
  }

  if (!company) {
    return (
      <div className="Company_Suppliers">
        <span className="Company_Suppliers_Message">{t('companies.notFound')}</span>
      </div>
    );
  }

  return (
    <div className="Company_Suppliers">
      <div className="Suppliers_Card">
        <div className="Card_Header">
          <div className="Card_Header_Text">
            <span className="Card_Title">{t('menu.suppliers')}</span>
            <span className="Card_Subtitle">{company.name}</span>
          </div>

          <div className="Card_Header_Action">
            {can('suppliers.create') && (
              <Simple_Button
                text={t('suppliers.addSupplier')}
                onClick={() => setIsFormOpen(true)}
              />
            )}
          </div>
        </div>

        <div className="Suppliers_Body">
          {loadingSuppliers ? (
            <span className="Company_Suppliers_Message">{t('common.loading')}</span>
          ) : suppliers.length === 0 ? (
            <span className="Company_Suppliers_Message">{t('suppliers.empty')}</span>
          ) : (
            <>
  <div className="Suppliers_Table_Scroll">
                <table className="Suppliers_Table">
                  <thead>
                    <tr>
                      <th>{t('suppliers.columnName')}</th>
                      <th>{t('suppliers.columnStatus')}</th>
                      <th>{t('suppliers.columnGroup')}</th>
                      <th>{t('suppliers.columnType')}</th>
                      <th>{t('suppliers.columnTaxId')}</th>
                      <th>{t('suppliers.contact')}</th>
                      <th>{t('suppliers.email')}</th>
                      <th>{t('suppliers.columnPayment')}</th>
                      <th></th>
                    </tr>
                  </thead>
                  <tbody>
                    {suppliers.map((supplier) => (
                      <tr key={supplier.id}>
                        <td className="Supplier_Name">
                          <span className="Supplier_Name_Line">
                            {supplier.platform?.logo && (
                              <img className="Supplier_Logo" src={supplier.platform.logo} alt="" loading="lazy" />
                            )}
                            {supplier.name}
                          </span>
                          {supplier.alias && <span className="Supplier_Alias">{supplier.alias}</span>}
                          {supplier.platform && (
                            <span className="Supplier_Alias">
                              {t('suppliers.fromCatalog', { category: t(`suppliers.catalog_${supplier.platform.type}`) })}
                            </span>
                          )}
                        </td>
                        <td>
                          <span
                            className={`Supplier_Status ${supplier.isActive ? 'Active' : 'Inactive'}`}
                          >
                            {t(supplier.isActive ? 'suppliers.statusActive' : 'suppliers.statusInactive')}
                          </span>
                        </td>
                        <td>{supplier.group?.name ?? '—'}</td>
                        <td>{t(`suppliers.type_${supplier.type}`)}</td>
                        <td>{supplier.taxNumber ?? '—'}</td>
                        <td>{supplier.contact ?? '—'}</td>
                        <td>{supplier.email ?? '—'}</td>
                        <td>
                          {supplier.paymentMethod === 'direct'
                            ? t('suppliers.directPaymentShort')
                            : supplier.bankAccount?.name ?? '—'}
                        </td>
                        <td className="Right">
                          <div className="Supplier_Actions">
                            <button
                              type="button"
                              className="Row_Action"
                              // Editar é na página do fornecedor, com os separadores todos
                              onClick={() => navigate(`/Companies/${company.slug}/compras/fornecedores/${supplier.slug}`)}
                              title={t('common.edit')}
                              aria-label={t('common.edit')}
                            >
                              <Icon.Edit />
                            </button>
                            {can('suppliers.delete') && (
                              <button
                                type="button"
                                className="Row_Action Danger"
                                onClick={() => setSupplierToDelete(supplier)}
                                title={t('common.delete')}
                                aria-label={t('common.delete')}
                              >
                                <Icon.Trash />
                              </button>
                            )}
                          </div>
                        </td>
                      </tr>
                    ))}
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

      {isFormOpen && (
        <Supplier_Form_Popover
          companyId={company.id}
          companyName={company.name}
          onClose={() => setIsFormOpen(false)}
          onSaved={() => {
            setIsFormOpen(false);
            refresh();
          }}
        />
      )}

      {supplierToDelete && (
        <Delete_Supplier_Popover
          supplierName={supplierToDelete.name}
          onClose={() => setSupplierToDelete(null)}
          // O backend recusa quando há pagamentos ou itens — o alerta diz para desativar
          onConfirm={async () => {
            if (deleting) return;

            const deleted = await deleteSupplier(supplierToDelete.id);
            setSupplierToDelete(null);

            if (deleted) refresh();
          }}
        />
      )}
    </div>
  );
};

export default Company_Suppliers;

import { useState } from 'react';
import { useNavigate, useParams } from 'react-router';
import { useTranslation } from 'react-i18next';
import { useCompanies } from '../../../../Hooks/Companies/useCompanies';
import { useCompanyItems } from '../../../../Hooks/Companies/useCompanyItems';
import { useBreadcrumbSegmentLabel } from '../../../../Contexts/Breadcrumb_Context';
import Simple_Button from '../../../../Components/Buttons/Simple_Button/Simple_Button';
import Global_Pagination from '../../../../Components/Pagination/Global_Pagination/Global_Pagination';
import Item_Form_Popover from './Item_Form_Popover';
import Delete_Item_Popover from './Delete_Item_Popover';
import type { CompanyItem } from '../../../../Hooks/Companies/useCompanyItems';
import * as Icon from '../../../../Imports/icons';
import { useCompany } from '../../../../Contexts/Company_Context';
import './Company_Items.scss';
import { localeOf } from '../../../../utils/locale';

const Company_Items = () => {
  const { slug } = useParams();
  const { companies, loading: loadingCompanies } = useCompanies();
  const { can } = useCompany();
  const { t, i18n } = useTranslation();
  const [isFormOpen, setIsFormOpen] = useState(false);
  const navigate = useNavigate();
  const [itemToDelete, setItemToDelete] = useState<CompanyItem | null>(null);

  const company = companies.find((item) => item.slug === slug);

  useBreadcrumbSegmentLabel(slug, company?.name);

  const {
    items,
    loading: loadingItems,
    refresh,
    deleteItem,
    page,
    setPage,
    total,
    totalPages,
    pageSize,
  } = useCompanyItems(company?.id);

  // O preço chega como string (Decimal do Prisma) e a moeda pode não existir
  const formatPrice = (item: CompanyItem) => {
    if (item.defaultPrice === null || item.defaultPrice === '') return '—';

    const value = Number(item.defaultPrice);

    if (Number.isNaN(value)) return '—';

    const formatted = value.toLocaleString(localeOf(i18n.language), {
      minimumFractionDigits: 2,
      maximumFractionDigits: 2,
    });

    return item.currency ? `${formatted} ${item.currency.symbol}` : formatted;
  };

  const formatRecurrence = (item: CompanyItem) => {
    if (!item.isRecurring || !item.recurrencePeriod) return '—';

    return t(`items.recurrence_${item.recurrencePeriod}`);
  };

  if (loadingCompanies) {
    return (
      <div className="Company_Items">
        <span className="Company_Items_Message">{t('common.loading')}</span>
      </div>
    );
  }

  if (!company) {
    return (
      <div className="Company_Items">
        <span className="Company_Items_Message">{t('companies.notFound')}</span>
      </div>
    );
  }

  return (
    <div className="Company_Items">
      <div className="Items_Card">
        <div className="Card_Header">
          <div className="Card_Header_Text">
            <span className="Card_Title">{t('items.title')}</span>
            <span className="Card_Subtitle">{company.name}</span>
          </div>

          <div className="Card_Header_Action">
            {can('items.create') && (
              <Simple_Button text={t('items.addItem')} onClick={() => setIsFormOpen(true)} />
            )}
          </div>
        </div>

        <div className="Items_Body">
          {loadingItems ? (
            <span className="Company_Items_Message">{t('common.loading')}</span>
          ) : items.length === 0 ? (
            <span className="Company_Items_Message">{t('items.empty')}</span>
          ) : (
            <>
  <div className="Items_Table_Scroll">
                <table className="Items_Table">
                  <thead>
                    <tr>
                      <th>{t('items.columnName')}</th>
                      <th>{t('items.columnType')}</th>
                      <th>{t('items.columnKind')}</th>
                      <th>{t('items.columnSupplier')}</th>
                      <th>{t('items.columnPrice')}</th>
                      <th>{t('items.columnRecurrence')}</th>
                      <th>{t('items.columnStatus')}</th>
                      <th></th>
                    </tr>
                  </thead>
                  <tbody>
                    {items.map((item) => (
                      <tr key={item.id}>
                        <td className="Item_Name">
                          {item.name}
                          {item.description && (
                            <span className="Item_Description">{item.description}</span>
                          )}
                        </td>
                        <td>{t(`items.type_${item.type}`)}</td>
                        <td>
                          <span className={`Item_Kind ${item.kind}`}>
                            {t(`items.kind_${item.kind}`)}
                          </span>
                        </td>
                        <td>
                          {item.suppliers.length > 0
                            ? item.suppliers.map((supplier) => supplier.name).join(', ')
                            : '—'}
                        </td>
                        <td>{formatPrice(item)}</td>
                        <td>{formatRecurrence(item)}</td>
                        <td>
                          <span className={`Item_Status ${item.isActive ? 'Active' : 'Inactive'}`}>
                            {t(item.isActive ? 'items.statusActive' : 'items.statusInactive')}
                          </span>
                        </td>
                        <td className="Right">
                          <div className="Item_Actions">
                            <button
                              type="button"
                              className="Row_Action"
                              // Editar é na página do item, com os separadores todos
                              onClick={() => navigate(`/Companies/${company.slug}/compras/itens/${item.slug}`)}
                              title={t('common.edit')}
                              aria-label={t('common.edit')}
                            >
                              <Icon.Edit />
                            </button>
                            {can('items.delete') && (
                              <button
                                type="button"
                                className="Row_Action Danger"
                                onClick={() => setItemToDelete(item)}
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
        <Item_Form_Popover
          companyId={company.id}
          companyName={company.name}
          onClose={() => setIsFormOpen(false)}
          onSaved={async () => {
            setIsFormOpen(false);
            await refresh();
          }}
        />
      )}

      {itemToDelete && (
        <Delete_Item_Popover
          itemName={itemToDelete.name}
          onClose={() => setItemToDelete(null)}
          onConfirm={async () => {
            const deleted = await deleteItem(itemToDelete.id);

            if (deleted) setItemToDelete(null);
          }}
        />
      )}
    </div>
  );
};

export default Company_Items;

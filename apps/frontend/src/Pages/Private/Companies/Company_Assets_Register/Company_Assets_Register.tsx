import { useState } from 'react';
import { useParams } from 'react-router';
import { useTranslation } from 'react-i18next';
import { useCompanies } from '../../../../Hooks/Companies/useCompanies';
import { useCompanyAssets, type CompanyAsset } from '../../../../Hooks/Companies/useCompanyAssets';
import { useBreadcrumbSegmentLabel } from '../../../../Contexts/Breadcrumb_Context';
import { useCurrencyFormat } from '../../../../Hooks/useCurrencyFormat';
import Simple_Button from '../../../../Components/Buttons/Simple_Button/Simple_Button';
import Global_Pagination from '../../../../Components/Pagination/Global_Pagination/Global_Pagination';
import Asset_Form_Popover from './Asset_Form_Popover';
import Delete_Asset_Popover from './Delete_Asset_Popover';
import * as Icon from '../../../../Imports/icons';
import { useCompany } from '../../../../Contexts/Company_Context';
import './Company_Assets_Register.scss';
import { localeOf } from '../../../../utils/locale';

const Company_Assets_Register = () => {
  const { slug } = useParams();
  const { companies } = useCompanies();
  const { can } = useCompany();
  const { t, i18n } = useTranslation();
  const { formatIn } = useCurrencyFormat();

  const company = companies.find((item) => item.slug === slug);
  const {
    assets,
    loading,
    refresh,
    createAsset,
    updateAsset,
    deleteAsset,
    page,
    setPage,
    total,
    totalPages,
    pageSize,
    totals,
  } = useCompanyAssets(
    company?.id,
  );

  const [isFormOpen, setIsFormOpen] = useState(false);
  const [assetToEdit, setAssetToEdit] = useState<CompanyAsset | undefined>();
  const [assetToDelete, setAssetToDelete] = useState<CompanyAsset | undefined>();

  useBreadcrumbSegmentLabel(slug, company?.name);

  const closeForm = () => {
    setIsFormOpen(false);
    setAssetToEdit(undefined);
  };

  // A empresa trabalha só na moeda dela, por isso é nela que os ativos estão —
  // não na que estiver escolhida nas definições, que é preferência de quem está
  // a ver e não muda o que o número é.
  const money = (value: number | null, decimals = 2) =>
    value === null ? '—' : formatIn(value, company?.currency, decimals);


  return (
    <div className="Company_Assets_Register">
      <div className="Page_Card">
        <div className="Card_Header">
          <div className="Card_Header_Text">
            <span className="Card_Title">{t('assets.registerTitle')}</span>
            <span className="Card_Subtitle">
              {loading ? ' ' : t('assets.count', { count: total })}
            </span>
          </div>

          <div className="Card_Header_Action">
            {can('assets.create') && (
              <Simple_Button text={t('assets.create')} onClick={() => setIsFormOpen(true)} />
            )}
          </div>
        </div>

        {loading ? (
          <span className="Empty_Message">{t('common.loading')}</span>
        ) : assets.length === 0 ? (
          <span className="Empty_Message">{t('assets.empty')}</span>
        ) : (
          <>
  <div className="Assets_Table_Scroll">
              <table className="Assets_Table">
                <thead>
                  <tr>
                    <th>{t('assets.columnName')}</th>
                    <th>{t('assets.columnCategory')}</th>
                    <th>{t('assets.columnAcquiredAt')}</th>
                    <th className="Right">{t('assets.columnValue')}</th>
                    <th className="Right">{t('assets.columnRate')}</th>
                    <th className="Right">{t('assets.columnDepreciated')}</th>
                    <th className="Right">{t('assets.columnNetValue')}</th>
                    <th className="Right">{t('assets.columnCostPerHour')}</th>
                    <th>{t('assets.columnStatus')}</th>
                    <th></th>
                  </tr>
                </thead>

                <tbody>
                  {assets.map((asset) => (
                    <tr key={asset.id}>
                      <td className="Asset_Name">
                        {asset.name}
                        <span className={`Asset_Origin ${asset.payment ? '' : 'Manual'}`}>
                          {asset.payment
                            ? t('assets.fromPayment', {
                                reference: asset.payment.reference ?? t('assets.noReference'),
                              })
                            : t('assets.noPaymentOrigin')}
                        </span>
                      </td>
                      <td>
                        <span className="Pill">{t(`assets.category_${asset.category}`)}</span>
                      </td>
                      <td className="Numeric Left">
                        {new Date(asset.acquisitionDate).toLocaleDateString(localeOf(i18n.language))}
                      </td>
                      <td className="Amount">{money(Number(asset.acquisitionValue))}</td>
                      <td className="Amount">{Number(asset.depreciationRate)}%</td>
                      <td className="Amount Asset_Depreciated">
                        {money(asset.accumulatedDepreciation)}
                      </td>
                      <td className="Amount Asset_Net">{money(asset.netBookValue)}</td>
                      <td className="Amount">
                        {asset.costPerHour === null ? (
                          <span className="Dim">—</span>
                        ) : (
                          `${money(asset.costPerHour, 4)}/h`
                        )}
                      </td>
                      <td>
                        <span className={`Asset_Status ${asset.status}`}>
                          {t(`assets.status_${asset.status}`)}
                        </span>
                      </td>
                      <td className="Right">
                        <div className="Asset_Actions">
                          {can('assets.edit') && (
                            <button
                              type="button"
                              className="Row_Action"
                              onClick={() => {
                                setAssetToEdit(asset);
                                setIsFormOpen(true);
                              }}
                              aria-label={t('common.edit')}
                            >
                              <Icon.Edit />
                            </button>
                          )}
                          {can('assets.delete') && (
                            <button
                              type="button"
                              className="Row_Action Danger"
                              onClick={() => setAssetToDelete(asset)}
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

                {/* Os totais só fazem sentido lidos juntos: o que se pagou, o que
                    já se gastou em amortização e o que ainda vale */}
                <tfoot>
                  <tr>
                    <td colSpan={3}>{t('assets.totals')}</td>
                    <td className="Amount">{money(totals.acquisition)}</td>
                    <td></td>
                    <td className="Amount Asset_Depreciated">{money(totals.depreciated)}</td>
                    <td className="Amount Asset_Net">{money(totals.net)}</td>
                    <td colSpan={3}></td>
                  </tr>
                </tfoot>
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

      {isFormOpen && company && (
        <Asset_Form_Popover
          companyId={company.id}
          companyName={company.name}
          companyCurrencyId={company.currencyId}
          asset={assetToEdit}
          onClose={closeForm}
          onSubmit={async (payload) => {
            const saved = assetToEdit
              ? await updateAsset(assetToEdit.id, payload)
              : await createAsset(payload);

            if (saved) {
              closeForm();
              await refresh();
            }
          }}
        />
      )}

      {assetToDelete && (
        <Delete_Asset_Popover
          assetName={assetToDelete.name}
          onClose={() => setAssetToDelete(undefined)}
          onConfirm={async () => {
            const deleted = await deleteAsset(assetToDelete.id);

            if (deleted) {
              setAssetToDelete(undefined);
              await refresh();
            }
          }}
        />
      )}
    </div>
  );
};

export default Company_Assets_Register;

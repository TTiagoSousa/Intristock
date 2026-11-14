import { useEffect, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { useTranslation } from 'react-i18next';
import http from '../../../../../../Service/httpService';
import { End_Points } from '../../../../../../Service/endPoints';
import Global_Input from '../../../../../../Components/Inputs/Global_Input/Global_Input';
import { getErrorMessage } from '../../../../../../Hooks/useAsyncRequest';

interface Stored_Prop_Firm {
  id: string;
  name: string;
  isActive: boolean;
  source: string;
  syncedAt: string | null;
  planCount: number;
  // A linha da `PropFirmDetail` (a nota chega como texto: é decimal na base)
  propFirm: {
    assetType: string | null;
    countryName: string | null;
    score: string | null;
    safetyGrade: string | null;
    profitSplit: string | null;
    detailsSyncedAt: string | null;
  } | null;
}

type State_Filter = 'all' | 'active' | 'inactive';

/**
 * As prop firms que estão na base, sem ir à API: filtros pelo tipo, pelo
 * estado e pelo nome; cada linha abre a página da firma.
 */
const Prop_Firms_Stored = ({ formatDate }: { formatDate: (iso: string) => string }) => {
  const { t } = useTranslation();
  const navigate = useNavigate();
  const [firms, setFirms] = useState<Stored_Prop_Firm[] | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [assetType, setAssetType] = useState('all');
  const [state, setState] = useState<State_Filter>('all');
  const [search, setSearch] = useState('');

  useEffect(() => {
    http
      .get<Stored_Prop_Firm[]>(End_Points.Prop_Firms_Endpoint())
      .then((response) => setFirms(response.data))
      .catch((err) => setError(getErrorMessage(err)));
  }, []);

  if (error) return <span className="Api_Sync_Detail Bad">{error}</span>;
  if (!firms) return <span className="Admin_Message">{t('common.loading')}</span>;
  if (firms.length === 0) {
    return (
      <div className="Empty_State">
        <span className="Empty_State_Title">{t('adminApis.propFirms.never')}</span>
        <span className="Empty_State_Text">{t('adminApis.propFirms.neverHint')}</span>
      </div>
    );
  }

  const assetTypes = [...new Set(firms.map((firm) => firm.propFirm?.assetType).filter(Boolean))] as string[];
  const query = search.trim().toLowerCase();
  const visible = firms.filter(
    (firm) =>
      (assetType === 'all' || firm.propFirm?.assetType === assetType) &&
      (state === 'all' || (state === 'active' ? firm.isActive : !firm.isActive)) &&
      (!query || firm.name.toLowerCase().includes(query)),
  );

  return (
    <>
      <div className="Prop_Firms_Filters">
        <div className="Tabs">
          <button type="button" className={assetType === 'all' ? 'Active' : ''} onClick={() => setAssetType('all')}>
            {t('adminApis.propFirms.filter_all', { count: firms.length })}
          </button>
          {assetTypes.map((type) => (
            <button key={type} type="button" className={assetType === type ? 'Active' : ''} onClick={() => setAssetType(type)}>
              {type} ({firms.filter((firm) => firm.propFirm?.assetType === type).length})
            </button>
          ))}
        </div>
        <div className="Tabs">
          {(['all', 'active', 'inactive'] as State_Filter[]).map((key) => (
            <button key={key} type="button" className={state === key ? 'Active' : ''} onClick={() => setState(key)}>
              {t(`adminApis.propFirms.state_${key}`)}
            </button>
          ))}
        </div>
        <div className="Prop_Firms_Search">
          <Global_Input
            id="prop-firms-search"
            value={search}
            placeholder={t('adminApis.propFirms.search')}
            onChange={(e) => setSearch(e.target.value)}
          />
        </div>
      </div>

      <div className="Table_Wrap">
        <table className="Table">
          <thead>
            <tr>
              <th>{t('adminApis.propFirms.firm')}</th>
              <th>{t('adminApis.propFirms.fields.assetType')}</th>
              <th>{t('adminApis.propFirms.fields.country')}</th>
              <th className="Right">{t('adminApis.propFirms.fields.score')}</th>
              <th>{t('adminApis.propFirms.fields.safetyGrade')}</th>
              <th>{t('adminApis.propFirms.fields.profitSplit')}</th>
              <th className="Right">{t('adminApis.propFirms.plansTitle')}</th>
              <th>{t('adminApis.propFirms.updated')}</th>
            </tr>
          </thead>
          <tbody>
            {visible.map((firm) => (
              <tr key={firm.id} className="Clickable" onClick={() => navigate(firm.id)}>
                <td>
                  <span className="Prop_Firm_Name">{firm.name}</span>
                  <div className="Admin_Muted_Cell">
                    {[
                      t(`adminPlatforms.sources.${firm.source}`, { defaultValue: firm.source }),
                      firm.isActive ? null : t('adminApis.propFirms.inactive'),
                    ]
                      .filter(Boolean)
                      .join(' · ')}
                  </div>
                </td>
                <td>{firm.propFirm?.assetType ?? '—'}</td>
                <td>{firm.propFirm?.countryName ?? '—'}</td>
                <td className="Num Right">{firm.propFirm?.score != null ? Number(firm.propFirm.score) : '—'}</td>
                <td>{firm.propFirm?.safetyGrade ?? '—'}</td>
                <td className="Admin_Muted_Cell">{firm.propFirm?.profitSplit ?? '—'}</td>
                <td className="Num Right">
                  {firm.propFirm?.detailsSyncedAt ? firm.planCount : t('adminApis.propFirms.noDetailsShort')}
                </td>
                <td className="Num Admin_Muted_Cell Admin_Nowrap">
                  {firm.propFirm?.detailsSyncedAt
                    ? formatDate(firm.propFirm.detailsSyncedAt)
                    : firm.syncedAt
                      ? formatDate(firm.syncedAt)
                      : '—'}
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    </>
  );
};

export default Prop_Firms_Stored;

import { useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { useTranslation } from 'react-i18next';
import Simple_Button from '../../../../../../Components/Buttons/Simple_Button/Simple_Button';
import Global_Input from '../../../../../../Components/Inputs/Global_Input/Global_Input';
import {
  fetchPropFirmCompare,
  type Prop_Firm_Compare,
  type Prop_Firm_Compare_Row,
  type Prop_Firm_Compare_Status,
} from '../../../../../../Hooks/Admin/usePropFirmSync';
import { getErrorMessage } from '../../../../../../Hooks/useAsyncRequest';

type Filter = 'all' | Prop_Firm_Compare_Status;
const FILTERS: Filter[] = ['all', 'new', 'changed', 'same', 'removed', 'local'];

const STATUS_TONE: Record<Prop_Firm_Compare_Status, string> = {
  new: 'Info',
  changed: 'Warn',
  same: 'Ok',
  removed: 'Bad',
  local: '',
};

interface Prop_Firms_Diff_Props {
  formatDate: (iso: string) => string;
  // Depois de comparar, os números do topo voltam a ler-se
  onCompared: () => void;
}

/**
 * A base contra a API, firma a firma. Só vai à API quando se carrega em
 * «Comparar agora» (lê a lista dela, ~6 pedidos).
 */
const Prop_Firms_Diff = ({ formatDate, onCompared }: Prop_Firms_Diff_Props) => {
  const { t } = useTranslation();
  const navigate = useNavigate();
  const [data, setData] = useState<Prop_Firm_Compare | null>(null);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [filter, setFilter] = useState<Filter>('all');
  const [search, setSearch] = useState('');

  const compare = () => {
    setLoading(true);
    setError(null);
    fetchPropFirmCompare()
      .then((result) => {
        setData(result);
        onCompared();
      })
      .catch((err) => setError(getErrorMessage(err)))
      .finally(() => setLoading(false));
  };

  const describe = (snapshot: Prop_Firm_Compare_Row['api']) =>
    snapshot
      ? [snapshot.assetType, snapshot.country, snapshot.score !== null ? `${snapshot.score}/10` : null, snapshot.safetyGrade]
          .filter(Boolean)
          .join(' · ')
      : '—';

  const query = search.trim().toLowerCase();
  const rows = (data?.rows ?? []).filter(
    (row) => (filter === 'all' || row.status === filter) && (!query || row.name.toLowerCase().includes(query)),
  );

  return (
    <>
      <div className="Prop_Firms_Diff_Head">
        <span className="Api_Sync_Detail">
          {data
            ? t('adminApis.propFirms.compareSubtitleAt', {
                api: data.apiCount,
                db: data.dbCount,
                date: formatDate(data.checkedAt),
              })
            : t('adminApis.propFirms.compareIntro')}
        </span>
        <Simple_Button
          text={loading ? t('adminApis.propFirms.comparing') : t('adminApis.propFirms.compareNow')}
          onClick={compare}
          disabled={loading}
          variant="Ghost"
          small
          auto
        />
      </div>

      {error && <span className="Api_Sync_Detail Bad">{error}</span>}

      {data && (
        <>
          <div className="Prop_Firms_Filters">
            <div className="Tabs">
              {FILTERS.map((key) => (
                <button key={key} type="button" className={filter === key ? 'Active' : ''} onClick={() => setFilter(key)}>
                  {t(`adminApis.propFirms.filter_${key}`, { count: key === 'all' ? data.rows.length : data.counts[key] })}
                </button>
              ))}
            </div>
            <div className="Prop_Firms_Search">
              <Global_Input
                id="prop-firms-diff-search"
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
                  <th>{t('adminApis.propFirms.state')}</th>
                  <th>{t('adminApis.propFirms.inApi')}</th>
                  <th>{t('adminApis.propFirms.inDb')}</th>
                </tr>
              </thead>
              <tbody>
                {rows.map((row) => (
                  <tr
                    key={row.key}
                    className={row.db ? 'Clickable' : ''}
                    onClick={() => row.db && navigate(row.db.id)}
                  >
                    <td>
                      <span className="Prop_Firm_Name">{row.name}</span>
                      {row.diffs.length > 0 && (
                        <div className="Admin_Muted_Cell">
                          {t('adminApis.propFirms.differs', {
                            fields: row.diffs.map((field) => t(`adminApis.propFirms.fields.${field}`)).join(', '),
                          })}
                        </div>
                      )}
                    </td>
                    <td>
                      <span className={`Pill ${STATUS_TONE[row.status]}`}>{t(`adminApis.propFirms.status_${row.status}`)}</span>
                    </td>
                    <td className="Admin_Muted_Cell">{describe(row.api)}</td>
                    <td className="Admin_Muted_Cell">
                      {row.db
                        ? [
                            row.db.isActive ? null : t('adminApis.propFirms.inactive'),
                            row.db.plans !== null
                              ? t('adminApis.propFirms.plans', { count: row.db.plans })
                              : t('adminApis.propFirms.noDetailsShort'),
                            row.db.detailsSyncedAt ? formatDate(row.db.detailsSyncedAt) : null,
                          ]
                            .filter(Boolean)
                            .join(' · ')
                        : '—'}
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </>
      )}
    </>
  );
};

export default Prop_Firms_Diff;

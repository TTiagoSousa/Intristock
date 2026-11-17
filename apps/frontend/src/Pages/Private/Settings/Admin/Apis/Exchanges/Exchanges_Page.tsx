import { useEffect, useState } from 'react';
import { Link } from 'react-router-dom';
import { useTranslation } from 'react-i18next';
import http from '../../../../../../Service/httpService';
import { End_Points } from '../../../../../../Service/endPoints';
import Simple_Button from '../../../../../../Components/Buttons/Simple_Button/Simple_Button';
import Global_Input from '../../../../../../Components/Inputs/Global_Input/Global_Input';
import Global_Dropdown from '../../../../../../Components/Inputs/Global_Dropdown/Global_Dropdown';
import { useCatalogSync } from '../../../../../../Hooks/Admin/useCatalogSync';
import { getErrorMessage } from '../../../../../../Hooks/useAsyncRequest';
import '../../Admin.scss';
import '../Apis.scss';
import '../Prop_Firms/Prop_Firms.scss';
import './Exchanges.scss';

interface Stored_Exchange {
  id: string;
  name: string;
  logo: string | null;
  website: string | null;
  isActive: boolean;
  source: string;
  syncedAt: string | null;
  country: { name: string; iso2: string } | null;
}

type State_Filter = 'all' | 'active' | 'inactive';

const COINGECKO = 'coingecko';

// O site sem o https:// nem a barra do fim, para caber na tabela
const shortUrl = (url: string) => url.replace(/^https?:\/\/(www\.)?/, '').replace(/\/+$/, '');

/**
 * A página da API das exchanges (Definições → APIs → Exchanges): o atualizar,
 * os números e as exchanges que estão nas plataformas (de qualquer origem), com
 * os filtros pela origem, pelo estado, pelo país e pelo nome.
 */
const Exchanges_Page = () => {
  const { t, i18n } = useTranslation();
  const { running, results, sync } = useCatalogSync();
  const [exchanges, setExchanges] = useState<Stored_Exchange[] | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [source, setSource] = useState('all');
  const [state, setState] = useState<State_Filter>('active');
  const [country, setCountry] = useState('all');
  const [search, setSearch] = useState('');

  const locale = i18n.language === 'pt' ? 'pt-PT' : 'en-GB';
  const formatDate = (iso: string) => new Date(iso).toLocaleString(locale, { dateStyle: 'short', timeStyle: 'short' });

  const load = () =>
    http
      .get<Stored_Exchange[]>(End_Points.Exchanges_Endpoint())
      .then((response) => {
        setExchanges(response.data);
        setError(null);
      })
      .catch((err) => setError(getErrorMessage(err)));

  useEffect(() => {
    load();
  }, []);

  const runSync = async () => {
    const result = await sync('exchanges');
    if (result.ok) load();
  };

  const result = results.exchanges;
  const list = exchanges ?? [];
  const fromApi = list.filter((e) => e.source === COINGECKO);
  const lastSync = fromApi.reduce<string | null>(
    (latest, e) => (e.syncedAt && (!latest || e.syncedAt > latest) ? e.syncedAt : latest),
    null,
  );
  const sources = [...new Set(list.map((e) => e.source))];
  const countries = [...new Map(list.filter((e) => e.country).map((e) => [e.country!.iso2, e.country!.name])).entries()].sort(
    (a, b) => a[1].localeCompare(b[1], locale),
  );
  const query = search.trim().toLowerCase();
  const visible = list.filter(
    (e) =>
      (source === 'all' || e.source === source) &&
      (state === 'all' || (state === 'active' ? e.isActive : !e.isActive)) &&
      (country === 'all' || e.country?.iso2 === country) &&
      (!query || e.name.toLowerCase().includes(query)),
  );
  const sourceLabel = (key: string) => t(`adminPlatforms.sources.${key}`, { defaultValue: key });

  return (
    <div className="Admin_Page Prop_Firms_Page Exchanges_Page">
      <Link to="/Settings/Admin/Apis" className="Prop_Firms_Back">
        ← {t('menu.apis')}
      </Link>

      <div className="Page_Head">
        <div>
          <h1>{t('adminApis.exchanges.pageTitle')}</h1>
          <div className="Page_Head_Sub">{t('adminApis.exchangePurpose')}</div>
        </div>
        <div className="Page_Head_Actions">
          <Simple_Button
            text={running === 'exchanges' ? t('adminApis.sync.running') : t('adminApis.exchanges.syncNow')}
            onClick={runSync}
            disabled={running !== null}
            auto
          />
        </div>
      </div>

      {result && (
        <div className={`Card Prop_Firms_Run ${result.ok ? '' : 'Bad'}`}>
          <span className="Card_Title">
            {result.ok ? t('adminApis.sync.exchangesDone', { count: result.count }) : result.message}
          </span>
        </div>
      )}

      <div className="Apis_Stats">
        <div className="Card Apis_Stat">
          <span className="Eyebrow">{t('adminApis.exchanges.statStored')}</span>
          <span className="Apis_Stat_Value Num">{exchanges ? list.filter((e) => e.isActive).length : '—'}</span>
        </div>
        <div className="Card Apis_Stat">
          <span className="Eyebrow">{t('adminApis.exchanges.statFromApi')}</span>
          <span className="Apis_Stat_Value Num">{exchanges ? fromApi.filter((e) => e.isActive).length : '—'}</span>
        </div>
        <div className="Card Apis_Stat">
          <span className="Eyebrow">{t('adminApis.exchanges.statCountries')}</span>
          <span className="Apis_Stat_Value Num">{exchanges ? countries.length : '—'}</span>
        </div>
        <div className="Card Apis_Stat">
          <span className="Eyebrow">{t('adminApis.exchanges.statLastSync')}</span>
          <span className={`Apis_Stat_Value Num ${exchanges && !lastSync ? 'Warn' : ''}`}>
            {lastSync ? formatDate(lastSync) : '—'}
          </span>
        </div>
      </div>

      <div className="Card Admin_Block Full">
        <div className="Admin_Block_Body">
          {error ? (
            <span className="Api_Sync_Detail Bad">{error}</span>
          ) : !exchanges ? (
            <span className="Admin_Message">{t('common.loading')}</span>
          ) : list.length === 0 ? (
            <div className="Empty_State">
              <span className="Empty_State_Title">{t('adminApis.exchangesNever')}</span>
              <span className="Empty_State_Text">{t('adminApis.exchanges.neverHint')}</span>
            </div>
          ) : (
            <>
              <div className="Prop_Firms_Filters Exchanges_Filters">
                <div className="Tabs">
                  <button type="button" className={source === 'all' ? 'Active' : ''} onClick={() => setSource('all')}>
                    {t('adminApis.propFirms.filter_all', { count: list.length })}
                  </button>
                  {sources.map((key) => (
                    <button key={key} type="button" className={source === key ? 'Active' : ''} onClick={() => setSource(key)}>
                      {sourceLabel(key)} ({list.filter((e) => e.source === key).length})
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
                <div className="Exchanges_Country">
                  <Global_Dropdown
                    id="exchanges-country"
                    value={country}
                    onChange={(value) => setCountry(String(value))}
                    searchable
                    options={[
                      { value: 'all', label: t('adminApis.exchanges.allCountries') },
                      ...countries.map(([iso2, name]) => ({ value: iso2, label: name })),
                    ]}
                  />
                </div>
                <div className="Prop_Firms_Search">
                  <Global_Input
                    id="exchanges-search"
                    value={search}
                    placeholder={t('adminApis.exchanges.search')}
                    onChange={(e) => setSearch(e.target.value)}
                  />
                </div>
              </div>

              <div className="Table_Wrap">
                <table className="Table">
                  <thead>
                    <tr>
                      <th>{t('adminApis.exchanges.exchange')}</th>
                      <th>{t('adminApis.propFirms.fields.country')}</th>
                      <th>{t('adminApis.exchanges.website')}</th>
                      <th>{t('adminApis.propFirms.updated')}</th>
                    </tr>
                  </thead>
                  <tbody>
                    {visible.map((e) => (
                      <tr key={e.id}>
                        <td>
                          <div className="Exchanges_Name">
                            {e.logo ? (
                              <img className="Exchanges_Logo" src={e.logo} alt="" loading="lazy" />
                            ) : (
                              <span className="Exchanges_Logo" aria-hidden />
                            )}
                            <div>
                              <span className="Prop_Firm_Name">{e.name}</span>
                              <div className="Admin_Muted_Cell">
                                {[sourceLabel(e.source), e.isActive ? null : t('adminApis.propFirms.inactive')]
                                  .filter(Boolean)
                                  .join(' · ')}
                              </div>
                            </div>
                          </div>
                        </td>
                        <td>{e.country?.name ?? '—'}</td>
                        <td>
                          {e.website ? (
                            <a href={e.website} target="_blank" rel="noreferrer" className="Api_Card_Link">
                              {shortUrl(e.website)}
                            </a>
                          ) : (
                            '—'
                          )}
                        </td>
                        <td className="Num Admin_Muted_Cell Admin_Nowrap">{e.syncedAt ? formatDate(e.syncedAt) : '—'}</td>
                      </tr>
                    ))}
                  </tbody>
                </table>
                {visible.length === 0 && <span className="Admin_Message">{t('adminApis.exchanges.noMatch')}</span>}
              </div>
            </>
          )}
        </div>
      </div>
    </div>
  );
};

export default Exchanges_Page;

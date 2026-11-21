import { useEffect, useState } from 'react';
import http from '../../../../../Service/httpService';
import { End_Points } from '../../../../../Service/endPoints';
import { useTranslation } from 'react-i18next';
import { useAdminPlatforms } from '../../../../../Hooks/Admin/useAdminPlatforms';
import { useCountries } from '../../../../../Hooks/useCountries';
import Simple_Button from '../../../../../Components/Buttons/Simple_Button/Simple_Button';
import Global_Input from '../../../../../Components/Inputs/Global_Input/Global_Input';
import Create_Platform_Popover from './Create_Platform_Popover';
import '../Admin.scss';

const Platforms = () => {
  const { t } = useTranslation();
  const { platforms, loading, saving, createPlatform } = useAdminPlatforms();
  const { countries } = useCountries();
  const [isCreateOpen, setIsCreateOpen] = useState(false);
  const [typeFilter, setTypeFilter] = useState<string>('all');
  const [search, setSearch] = useState('');
  // As ligações pela API de cada plataforma (as corretoras dos portefólios) e de quem são
  const [connections, setConnections] = useState<
    Record<string, { count: number; users: { id: string; name: string; account: string; status: string }[] }>
  >({});

  useEffect(() => {
    let cancelled = false;
    http
      .get(End_Points.Platform_Connections_Endpoint())
      .then(({ data }) => !cancelled && setConnections(data))
      .catch(() => undefined);
    return () => {
      cancelled = true;
    };
  }, []);

  const countryName = (countryId: string | null) =>
    countryId ? countries.find((country) => country.id === countryId)?.name ?? '—' : t('adminPlatforms.international');

  const sorted = [...platforms].sort((a, b) => a.type.localeCompare(b.type) || a.name.localeCompare(b.name));
  // Os tipos que há, pela ordem em que aparecem, com quantas de cada
  const types = [...new Set(sorted.map((platform) => platform.type))];
  const query = search.trim().toLowerCase();
  const visible = sorted.filter(
    (platform) =>
      (typeFilter === 'all' || platform.type === typeFilter) &&
      (!query || platform.name.toLowerCase().includes(query)),
  );

  return (
    <div className="Admin_Page">
      <div className="Page_Head">
        <div>
          <h1>{t('adminPlatforms.title')}</h1>
          <div className="Page_Head_Sub">{t('adminPlatforms.subtitle')}</div>
        </div>
        <div className="Page_Head_Actions">
          <Simple_Button text={t('adminPlatforms.new')} onClick={() => setIsCreateOpen(true)} auto />
        </div>
      </div>

      <div className="Card Admin_Block Full">
        {loading ? (
          <span className="Admin_Message">{t('common.loading')}</span>
        ) : (
          <div className="Admin_Block_Body">
            <div className="Platforms_Filters">
              <div className="Tabs">
                <button type="button" className={typeFilter === 'all' ? 'Active' : ''} aria-pressed={typeFilter === 'all'} onClick={() => setTypeFilter('all')}>
                  {t('adminPlatforms.all', { count: platforms.length })}
                </button>
                {types.map((type) => (
                  <button
                    key={type}
                    type="button"
                    className={typeFilter === type ? 'Active' : ''} aria-pressed={typeFilter === type}
                    onClick={() => setTypeFilter(type)}
                  >
                    {t(`adminPlatforms.types.${type}`)} ({sorted.filter((platform) => platform.type === type).length})
                  </button>
                ))}
              </div>
              <div className="Platforms_Search">
                <Global_Input
                  id="platforms-search"
                  value={search}
                  placeholder={t('adminPlatforms.search')}
                  onChange={(e) => setSearch(e.target.value)}
                />
              </div>
            </div>
            <div className="Table_Wrap">
              <table className="Table">
                <thead>
                  <tr>
                    <th>{t('adminPlatforms.name')}</th>
                    <th>{t('adminPlatforms.type')}</th>
                    <th>{t('adminPlatforms.country')}</th>
                    <th>{t('adminPlatforms.website')}</th>
                    <th>{t('adminPlatforms.source')}</th>
                    <th>{t('adminPlatforms.connections')}</th>
                  </tr>
                </thead>
                <tbody>
                  {visible.map((platform) => (
                    <tr key={platform.id}>
                      <td>{platform.name}</td>
                      <td>
                        <span className="Pill">{t(`adminPlatforms.types.${platform.type}`)}</span>
                      </td>
                      <td>{countryName(platform.countryId)}</td>
                      <td className="Num Admin_Muted_Cell">{platform.website ?? '—'}</td>
                      <td>
                        {/* De onde veio: as da API são as que o atualizar mantém */}
                        <span className={`Pill ${platform.source === 'manual' || platform.source === 'system' ? '' : 'Info'}`}>
                          {t(`adminPlatforms.sources.${platform.source}`, { defaultValue: platform.source })}
                        </span>
                      </td>
                      <td>
                        {connections[platform.id] ? (
                          <span
                            title={connections[platform.id].users
                              .map((user) => `${user.name} · ${user.account}`)
                              .join('\n')}
                          >
                            {t('adminPlatforms.connectionCount', {
                              count: connections[platform.id].count,
                              users: [...new Set(connections[platform.id].users.map((user) => user.name))].join(', '),
                            })}
                          </span>
                        ) : (
                          <span className="Admin_Muted_Cell">—</span>
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

      {isCreateOpen && (
        <Create_Platform_Popover saving={saving} onClose={() => setIsCreateOpen(false)} onSubmit={createPlatform} />
      )}
    </div>
  );
};

export default Platforms;

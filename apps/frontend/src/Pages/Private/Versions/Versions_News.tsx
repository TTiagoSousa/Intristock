import { useState } from 'react';
import { useNavigate, useSearchParams } from 'react-router-dom';
import { useTranslation } from 'react-i18next';
import { usePublicReleases } from '../../../Hooks/System/usePublicReleases';
import { useAuth } from '../../../Contexts/Auth_Context';
import Simple_Button from '../../../Components/Buttons/Simple_Button/Simple_Button';
import Release_Notes from '../../../Components/Release_Notes/Release_Notes';
import * as Icon from '../../../Imports/icons';
import '../Settings/Admin/Admin.scss';
import '../Settings/Admin/Versions/Versions.scss';
import './Versions_News.scss';

/**
 * As versões do IntriStock e o que cada uma trouxe, para todos os utilizadores.
 * A que está em uso vem marcada e aberta (ou a do endereço, ?v=, vinda de um
 * aviso). O admin tem o atalho para atualizar.
 */
const Versions_News = () => {
  const { t, i18n } = useTranslation();
  const navigate = useNavigate();
  const [searchParams] = useSearchParams();
  const { user } = useAuth();
  const isAdmin = user?.role === 'ADMIN';
  const { list, loading } = usePublicReleases();
  // As que o utilizador abriu ou fechou; sem mexer, abre a do endereço ou a em uso
  const [toggled, setToggled] = useState<Record<string, boolean>>({});
  const focus = searchParams.get('v') ?? list?.current ?? null;

  const formatDate = (iso: string) =>
    new Date(iso).toLocaleDateString(i18n.language === 'pt' ? 'pt-PT' : 'en-GB', {
      day: '2-digit',
      month: 'long',
      year: 'numeric',
    });

  const isOpen = (version: string) => toggled[version] ?? version === focus;
  const newer = list?.releases.filter((release) => release.newer).length ?? 0;

  return (
    <div className="Admin_Page Versions Versions_News">
      <div className="Page_Head">
        <div>
          <h1>{t('versionsNews.title')}</h1>
          <div className="Page_Head_Sub">
            {list?.current
              ? t(list.exact ? 'versionsNews.inUse' : 'versionsNews.inUseDev', { version: list.current })
              : t('versionsNews.subtitle')}
          </div>
        </div>
        {isAdmin && (
          <div className="Page_Head_Actions">
            <Simple_Button
              text={newer ? t('versionsNews.update', { count: newer }) : t('versionsNews.manage')}
              variant={newer ? undefined : 'Ghost'}
              onClick={() => navigate('/Versoes/atualizar')}
              auto
            />
          </div>
        )}
      </div>

      <div className="Card Admin_Block Full">
        <div className="Admin_Block_Body">
          {loading ? (
            <span className="Versions_News_Hint">{t('common.loading')}</span>
          ) : !list || list.releases.length === 0 ? (
            <div className="Empty_State">
              <span className="Empty_State_Title">{t('versions.noReleases')}</span>
            </div>
          ) : (
            <div className="Versions_List">
              {list.releases.map((release) => {
                const expanded = isOpen(release.version);
                return (
                  <article
                    key={release.version}
                    className={`Versions_Item${release.current ? ' Installed' : ''}${release.version === focus ? ' Focused' : ''}`}
                  >
                    <button
                      type="button"
                      className="Versions_Item_Head"
                      aria-expanded={expanded}
                      onClick={() => setToggled((current) => ({ ...current, [release.version]: !expanded }))}
                    >
                      <span className={`Versions_Chevron ${expanded ? 'Open' : ''}`}>
                        <Icon.Chevron_Down />
                      </span>
                      <span className="Versions_Item_Version Num">{release.version}</span>
                      {release.current && <span className="Pill Ok">{t('versionsNews.badgeCurrent')}</span>}
                      {release.newer && <span className="Pill Info">{t('versionsNews.badgeNew')}</span>}
                      <span className="Versions_Item_Date">{formatDate(release.date)}</span>
                    </button>

                    {expanded && (
                      <div className="Versions_Item_Body">
                        {release.title && release.title !== release.version && (
                          <p className="Versions_Item_Headline">{release.title}</p>
                        )}
                        <Release_Notes notes={release.notes} />
                      </div>
                    )}
                  </article>
                );
              })}
            </div>
          )}
          {list?.offline && <p className="Versions_Notice">{t('versions.offline')}</p>}
        </div>
      </div>
    </div>
  );
};

export default Versions_News;

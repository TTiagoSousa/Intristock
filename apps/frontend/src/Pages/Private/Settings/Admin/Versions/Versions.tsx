import { useState } from 'react';
import { useTranslation } from 'react-i18next';
import { useReleases } from '../../../../../Hooks/System/useReleases';
import { installedLabel } from '../../../../../Hooks/System/types';
import Simple_Button from '../../../../../Components/Buttons/Simple_Button/Simple_Button';
import Release_Notes from '../../../../../Components/Release_Notes/Release_Notes';
import Update_Popover from '../../../../../Components/Update_Popover/Update_Popover';
import * as Icon from '../../../../../Imports/icons';
import '../Admin.scss';
import './Versions.scss';

const Versions = () => {
  const { t, i18n } = useTranslation();
  const { overview, list, loading, fetchReleases } = useReleases();
  const [chosen, setChosen] = useState<string | null>(null);
  const [dismissed, setDismissed] = useState(false);
  const [open, setOpen] = useState<Set<string>>(new Set());

  const formatDate = (iso: string | null | undefined) =>
    iso
      ? new Date(iso).toLocaleDateString(i18n.language === 'pt' ? 'pt-PT' : 'en-GB', {
          day: '2-digit',
          month: 'long',
          year: 'numeric',
        })
      : '—';

  const toggle = (version: string) =>
    setOpen((current) => {
      const next = new Set(current);
      if (next.has(version)) next.delete(version);
      else next.add(version);
      return next;
    });

  const installed = installedLabel(overview?.installed);
  const next = overview?.next ?? null;

  // Uma atualização que já estava a correr (outra janela, ou a página recarregou
  // a meio) volta a ser acompanhada em vez de se pedir outra
  const inProgress =
    (overview?.update.state === 'running' || overview?.update.state === 'queued') && overview.update.target
      ? overview.update.target
      : null;
  const updating = chosen
    ? { version: chosen, resume: false }
    : inProgress && !dismissed
      ? { version: inProgress, resume: true }
      : null;

  return (
    <div className="Admin_Page Versions">
      <div className="Page_Head">
        <div>
          <h1>{t('versions.title')}</h1>
          <div className="Page_Head_Sub">{t('versions.subtitle')}</div>
        </div>
        <div className="Page_Head_Actions">
          <Simple_Button
            text={loading ? t('versions.searching') : t('versions.refresh')}
            onClick={() => fetchReleases(true)}
            disabled={loading}
            variant="Ghost"
            auto
          />
        </div>
      </div>

      <div className="Card Admin_Block">
        <div className="Admin_Block_Body">
          <div className="Versions_Summary">
            <div className="Tile">
              <span className="Eyebrow">{t('versions.installed')}</span>
              <span className="Tile_Value Num">{installed}</span>
              <span className="Tile_Foot">{formatDate(overview?.installed.date)}</span>
            </div>
            <div className="Tile">
              <span className="Eyebrow">{t('versions.next')}</span>
              <span className={`Tile_Value Num ${next ? 'Versions_New' : ''}`}>{next?.version ?? '—'}</span>
              <span className="Tile_Foot">
                {next ? formatDate(next.date) : t('versions.upToDate')}
                {overview?.offline && ` · ${t('versions.offline')}`}
              </span>
            </div>
            <div className="Tile">
              <span className="Eyebrow">{t('versions.latest')}</span>
              <span className="Tile_Value Num">{overview?.latest?.version ?? '—'}</span>
              <span className="Tile_Foot">
                {overview && overview.newerCount > 1
                  ? t('versions.stepsLeft', { count: overview.newerCount })
                  : overview?.latest
                    ? formatDate(overview.latest.date)
                    : t('versions.noReleases')}
              </span>
            </div>
          </div>

          {overview && !overview.updatesEnabled && <p className="Versions_Notice">{t('versions.vmOnly')}</p>}

          {next && overview?.updatesEnabled && (
            <div className="Versions_Next">
              <div className="Versions_Next_Text">
                <span className="Versions_Next_Title">
                  {t('versions.whatsNew', { version: next.version })}
                  {next.title && next.title !== next.version ? ` — ${next.title}` : ''}
                </span>
                <span className="Versions_Next_Hint">{t('versions.oneAtATime')}</span>
              </div>
              <Simple_Button text={t('versions.updateTo', { version: next.version })} onClick={() => setChosen(next.version)} auto />
            </div>
          )}
        </div>
      </div>

      <div className="Card Admin_Block">
        <div className="Card_Header">
          <div className="Card_Header_Text">
            <span className="Card_Title">{t('versions.allTitle')}</span>
            <span className="Card_Subtitle">{t('versions.allHint')}</span>
          </div>
        </div>

        <div className="Admin_Block_Body">
          {list && list.releases.length === 0 && !loading && (
            <div className="Empty_State">
              <span className="Empty_State_Title">{t('versions.noReleases')}</span>
            </div>
          )}

          <div className="Versions_List">
            {list?.releases.map((release) => {
              const expanded = open.has(release.version);
              return (
                <article key={release.version} className={`Versions_Item ${release.installed ? 'Installed' : ''}`}>
                  <button
                    type="button"
                    className="Versions_Item_Head"
                    aria-expanded={expanded}
                    onClick={() => toggle(release.version)}
                  >
                    <span className={`Versions_Chevron ${expanded ? 'Open' : ''}`}>
                      <Icon.Chevron_Down />
                    </span>
                    <span className="Versions_Item_Version Num">{release.version}</span>
                    {release.installed && <span className="Pill Ok">{t('versions.badgeInstalled')}</span>}
                    {release.next && <span className="Pill Info">{t('versions.badgeNext')}</span>}
                    {release.newer && !release.next && <span className="Pill">{t('versions.badgeLater')}</span>}
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
        </div>
      </div>

      {updating && (
        <Update_Popover
          version={updating.version}
          from={installed}
          resume={updating.resume}
          onClose={() => {
            setChosen(null);
            setDismissed(true);
            fetchReleases();
          }}
        />
      )}
    </div>
  );
};

export default Versions;

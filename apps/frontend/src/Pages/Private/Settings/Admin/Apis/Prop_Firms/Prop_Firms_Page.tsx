import { useState } from 'react';
import { Link } from 'react-router-dom';
import { useTranslation } from 'react-i18next';
import Simple_Button from '../../../../../../Components/Buttons/Simple_Button/Simple_Button';
import { usePropFirmSync } from '../../../../../../Hooks/Admin/usePropFirmSync';
import Prop_Firms_Stored from './Prop_Firms_Stored';
import Prop_Firms_Diff from './Prop_Firms_Diff';
import '../../Admin.scss';
import '../Apis.scss';
import './Prop_Firms.scss';

type Tab = 'stored' | 'diff';

/**
 * A página da API das prop firms (Definições → APIs → Prop firms): o atualizar
 * com o progresso, os números do que está na base e dois separadores — o que
 * está guardado (sem ir à API) e a base contra a API (só quando se pede).
 */
const Prop_Firms_Page = () => {
  const { t, i18n } = useTranslation();
  const { status, starting, error, start, refresh } = usePropFirmSync();
  const [tab, setTab] = useState<Tab>('stored');

  const locale = i18n.language === 'pt' ? 'pt-PT' : 'en-GB';
  const formatDate = (iso: string) => new Date(iso).toLocaleString(locale, { dateStyle: 'short', timeStyle: 'short' });

  const running = Boolean(status?.running);
  const progress = status?.progress;
  const failed = error ?? status?.error ?? null;

  return (
    <div className="Admin_Page Prop_Firms_Page">
      <Link to="/Settings/Admin/Apis" className="Prop_Firms_Back">
        ← {t('menu.apis')}
      </Link>

      <div className="Page_Head">
        <div>
          <h1>{t('adminApis.propFirms.pageTitle')}</h1>
          <div className="Page_Head_Sub">{t('adminApis.propFirms.pageSubtitle')}</div>
        </div>
        <div className="Page_Head_Actions">
          <Simple_Button
            text={running ? t('adminApis.sync.running') : t('adminApis.propFirms.syncNow')}
            onClick={start}
            disabled={running || starting}
            auto
          />
        </div>
      </div>

      {/* O atualizar em curso (ou o erro da última vez) numa faixa por cima de tudo */}
      {(running || failed || progress?.phase === 'done') && (
        <div className={`Card Prop_Firms_Run ${failed && !running ? 'Bad' : ''}`}>
          <div className="Prop_Firms_Run_Text">
            <span className="Card_Title">
              {running
                ? progress?.phase === 'details'
                  ? t('adminApis.propFirms.runningDetails', { done: progress.detailsDone, total: progress.detailsTotal })
                  : t('adminApis.propFirms.runningList')
                : failed
                  ? failed
                  : t('adminApis.propFirms.lastRunTitle', { date: status?.finishedAt ? formatDate(status.finishedAt) : '—' })}
            </span>
            {progress && (
              <span className="Card_Subtitle">
                {t('adminApis.propFirms.lastRun', {
                  created: progress.created,
                  updated: progress.updated,
                  deactivated: progress.deactivated,
                  failed: progress.detailsFailed,
                })}
              </span>
            )}
          </div>
          {running && progress?.phase === 'details' && progress.detailsTotal > 0 && (
            <div className="Prop_Firms_Progress">
              <span style={{ width: `${(progress.detailsDone / progress.detailsTotal) * 100}%` }} />
            </div>
          )}
        </div>
      )}

      <div className="Apis_Stats">
        <div className="Card Apis_Stat">
          <span className="Eyebrow">{t('adminApis.propFirms.statStored')}</span>
          <span className="Apis_Stat_Value Num">{status ? status.total : '—'}</span>
        </div>
        <div className="Card Apis_Stat">
          <span className="Eyebrow">{t('adminApis.propFirms.statFromApi')}</span>
          <span className="Apis_Stat_Value Num">{status ? status.fromApi : '—'}</span>
        </div>
        <div className="Card Apis_Stat">
          <span className="Eyebrow">{t('adminApis.propFirms.statPlans')}</span>
          <span className="Apis_Stat_Value Num">{status ? status.plans : '—'}</span>
        </div>
        <div className="Card Apis_Stat">
          <span className="Eyebrow">{t('adminApis.propFirms.statLastSync')}</span>
          <span className={`Apis_Stat_Value Num ${status && !status.lastSyncedAt ? 'Warn' : ''}`}>
            {status?.lastSyncedAt ? formatDate(status.lastSyncedAt) : '—'}
          </span>
        </div>
      </div>

      <div className="Card Admin_Block Full">
        <div className="Card_Header Prop_Firms_Tabs_Head">
          <div className="Tabs">
            <button type="button" className={tab === 'stored' ? 'Active' : ''} onClick={() => setTab('stored')}>
              {t('adminApis.propFirms.tabStored')}
            </button>
            <button type="button" className={tab === 'diff' ? 'Active' : ''} onClick={() => setTab('diff')}>
              {t('adminApis.propFirms.tabDiff')}
            </button>
          </div>
          <span className="Card_Subtitle">
            {t(tab === 'stored' ? 'adminApis.propFirms.tabStoredHint' : 'adminApis.propFirms.tabDiffHint')}
          </span>
        </div>

        <div className="Admin_Block_Body">
          {tab === 'stored' ? (
            // Volta a ler a base quando um atualizar acaba
            <Prop_Firms_Stored key={status?.finishedAt ?? 'initial'} formatDate={formatDate} />
          ) : (
            <Prop_Firms_Diff formatDate={formatDate} onCompared={refresh} />
          )}
        </div>
      </div>
    </div>
  );
};

export default Prop_Firms_Page;

import { useEffect, useMemo, useRef, useState } from 'react';
import { useTranslation } from 'react-i18next';
import { usePlatforms, type Platform } from '../../../../Hooks/usePlatforms';
import './Portfolio.scss';

// As corretoras que já se ligam pela API (o nome da plataforma no catálogo)
const SUPPORTED_BROKERS = ['Trading 212'];
const isSupported = (platform: Platform) => SUPPORTED_BROKERS.includes(platform.name);

/** O logótipo da plataforma; sem ele (ou se não carregar), a inicial num quadrado. */
const Picker_Logo = ({ platform }: { platform: Platform }) => {
  const [failed, setFailed] = useState(false);
  if (platform.logo && !failed)
    return <img className="Broker_Picker_Logo" src={platform.logo} alt="" loading="lazy" onError={() => setFailed(true)} />;
  return (
    <span className="Broker_Picker_Logo Initial" aria-hidden="true">
      {platform.name.charAt(0).toUpperCase()}
    </span>
  );
};

/**
 * O primeiro passo do «Ligar corretora»: as plataformas do catálogo em três grupos — as
 * que já se ligam (em destaque), as corretoras e as exchanges (estas «Em breve») —, com
 * pesquisa e scroll. Escolher uma que se liga chama `onPick`.
 */
const Broker_Picker = ({ onPick }: { onPick: (platform: Platform) => void }) => {
  const { t } = useTranslation();
  const { platforms, loading } = usePlatforms();
  const [query, setQuery] = useState('');
  const searchRef = useRef<HTMLInputElement>(null);

  useEffect(() => {
    searchRef.current?.focus();
  }, []);

  const groups = useMemo(() => {
    const term = query.trim().toLowerCase();
    const match = (platform: Platform) => !term || platform.name.toLowerCase().includes(term);
    const byName = (a: Platform, b: Platform) => a.name.localeCompare(b.name);
    const list = platforms.filter(match);
    return [
      { key: 'available', items: list.filter(isSupported).sort(byName) },
      { key: 'brokers', items: list.filter((p) => p.type === 'broker' && !isSupported(p)).sort(byName) },
      { key: 'exchanges', items: list.filter((p) => p.type === 'exchange' && !isSupported(p)).sort(byName) },
    ].filter((group) => group.items.length);
  }, [platforms, query]);

  return (
    <div className="Broker_Picker">
          <div className="Broker_Picker_Search">
            <svg viewBox="0 0 24 24" width="16" height="16" aria-hidden="true">
              <circle cx="11" cy="11" r="7" fill="none" stroke="currentColor" strokeWidth="1.5" />
              <path d="m20 20-3.5-3.5" fill="none" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" />
            </svg>
            <input
              ref={searchRef}
              value={query}
              placeholder={t('portfolio.searchBroker')}
              aria-label={t('portfolio.searchBroker')}
              autoComplete="off"
              onChange={(e) => setQuery(e.target.value)}
            />
          </div>

          <div className="Broker_Picker_List">
            {loading ? (
              <span className="Broker_Picker_Empty">{t('common.loading')}</span>
            ) : groups.length === 0 ? (
              <span className="Broker_Picker_Empty">{t('portfolio.noBrokerFound')}</span>
            ) : (
              groups.map((group) => (
                <div key={group.key} className="Broker_Picker_Group">
                  <span className="Broker_Picker_Group_Title">
                    {t(`portfolio.brokerGroup_${group.key}`)}
                    {group.key !== 'available' && <span className="Broker_Picker_Count">{group.items.length}</span>}
                  </span>
                  {group.items.map((platform) => {
                    const supported = group.key === 'available';
                    return (
                      <button
                        key={platform.id}
                        type="button"
                        className={`Broker_Picker_Item${supported ? ' Available' : ''}`}
                        disabled={!supported}
                        onClick={() => onPick(platform)}
                      >
                        <Picker_Logo platform={platform} />
                        <span className="Broker_Picker_Text">
                          <span className="Broker_Picker_Name">{platform.name}</span>
                          {supported && <span className="Broker_Picker_Hint">{t('portfolio.brokerApiHint')}</span>}
                        </span>
                        {supported ? (
                          <svg className="Broker_Picker_Arrow" viewBox="0 0 24 24" width="16" height="16" aria-hidden="true">
                            <path d="m9 6 6 6-6 6" fill="none" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round" />
                          </svg>
                        ) : (
                          <span className="Broker_Picker_Soon">{t('portfolio.comingSoon')}</span>
                        )}
                      </button>
                    );
                  })}
                </div>
              ))
            )}
      </div>
    </div>
  );
};

export default Broker_Picker;

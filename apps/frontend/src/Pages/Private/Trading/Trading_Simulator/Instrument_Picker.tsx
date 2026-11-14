import { useEffect, useLayoutEffect, useRef, useState } from 'react';
import { createPortal } from 'react-dom';
import { useTranslation } from 'react-i18next';
import {
  instrumentPair,
  sourceLabel,
  useInstrumentFacets,
  useMarketInstruments,
} from '../../../../Hooks/Trading/useMarketInstruments';
import type {
  Instrument_Filters,
  Instrument_Type,
  Market_Instrument,
} from '../../../../Hooks/Trading/useMarketInstruments';
import Global_Input from '../../../../Components/Inputs/Global_Input/Global_Input';
import { Chevron_Down, Search } from '../../../../Imports/icons';

interface Instrument_Picker_Props {
  value: Market_Instrument | null;
  onChange: (instrument: Market_Instrument) => void;
}

const TYPES: Instrument_Type[] = ['spot', 'perpetual', 'future'];

const PANEL_WIDTH = 460;
const GUTTER = 16;

/**
 * Input de ativos do simulador: abre um painel com pesquisa e filtros
 * (corretora e tipo de mercado). Escolher um ativo fecha o painel.
 */
const Instrument_Picker = ({ value, onChange }: Instrument_Picker_Props) => {
  const { t, i18n } = useTranslation();
  const [open, setOpen] = useState(false);
  const [filters, setFilters] = useState<Instrument_Filters>({ search: '', source: '', type: '' });
  const [position, setPosition] = useState({ top: 0, left: 0, width: PANEL_WIDTH });
  const fieldRef = useRef<HTMLDivElement>(null);
  const panelRef = useRef<HTMLDivElement>(null);

  const facets = useInstrumentFacets();
  const { instruments, total, loading, loadingMore, loadMore } = useMarketInstruments(filters, open);

  const typeLabel = (type: Instrument_Type) => t(`trading.type_${type}`);
  const typeCount = (type: Instrument_Type) => facets.types.find((item) => item.type === type)?.count;

  const updatePosition = () => {
    if (!fieldRef.current) return;
    const rect = fieldRef.current.getBoundingClientRect();
    const width = Math.min(Math.max(rect.width, PANEL_WIDTH), window.innerWidth - GUTTER * 2);
    const left = Math.min(rect.left, window.innerWidth - width - GUTTER);
    setPosition({ top: rect.bottom + 6, left: Math.max(GUTTER, left), width });
  };

  useLayoutEffect(() => {
    if (open) updatePosition();
  }, [open]);

  // Ao abrir, o cursor fica logo na pesquisa
  useEffect(() => {
    if (open) document.getElementById('trading-instrument-search')?.focus();
  }, [open]);

  useEffect(() => {
    if (!open) return;

    const handleClickOutside = (e: MouseEvent) => {
      const target = e.target as Node;
      if (fieldRef.current?.contains(target) || panelRef.current?.contains(target)) return;
      setOpen(false);
    };
    const handleEscape = (e: KeyboardEvent) => {
      if (e.key === 'Escape') setOpen(false);
    };
    const handleReposition = () => updatePosition();

    document.addEventListener('mousedown', handleClickOutside);
    document.addEventListener('keydown', handleEscape);
    window.addEventListener('scroll', handleReposition, true);
    window.addEventListener('resize', handleReposition);
    return () => {
      document.removeEventListener('mousedown', handleClickOutside);
      document.removeEventListener('keydown', handleEscape);
      window.removeEventListener('scroll', handleReposition, true);
      window.removeEventListener('resize', handleReposition);
    };
  }, [open]);

  const setFilter = <K extends keyof Instrument_Filters>(key: K, filterValue: Instrument_Filters[K]) =>
    setFilters((prev) => ({ ...prev, [key]: filterValue }));

  const choose = (instrument: Market_Instrument) => {
    onChange(instrument);
    setOpen(false);
  };

  const formatDate = (date: string) =>
    new Date(date).toLocaleDateString(i18n.language, { day: '2-digit', month: 'short', year: 'numeric' });

  return (
    <div className={`Instrument_Picker${open ? ' Open' : ''}${value ? '' : ' Empty'}`} ref={fieldRef}>
      <button
        id="trading-instrument"
        type="button"
        className="Instrument_Picker_Trigger"
        onClick={() => setOpen((prev) => !prev)}
      >
        <Search />
        <span>
          {value ? (
            <>
              <strong>{instrumentPair(value)}</strong>
              <em>
                {typeLabel(value.type)} · {sourceLabel(value.source)}
              </em>
            </>
          ) : (
            t('trading.searchInstrument')
          )}
        </span>
        <Chevron_Down />
      </button>

      {open &&
        createPortal(
          <div
            className="Instrument_Picker_Panel"
            ref={panelRef}
            style={{ top: position.top, left: position.left, width: position.width }}
          >
            <div className="Instrument_Picker_Search">
              <Global_Input
                id="trading-instrument-search"
                value={filters.search}
                onChange={(e) => setFilter('search', e.target.value)}
                placeholder={t('trading.searchPlaceholder')}
                icon={Search}
              />
            </div>

            <div className="Instrument_Picker_Filters">
              <div className="Filter_Group">
                <span className="Filter_Label">{t('trading.filterSource')}</span>
                <div className="Filter_Chips">
                  <button
                    type="button"
                    className={`Filter_Chip${filters.source === '' ? ' Active' : ''}`}
                    onClick={() => setFilter('source', '')}
                  >
                    {t('trading.filterAllSources')}
                  </button>
                  {facets.sources.map(({ source, count }) => (
                    <button
                      key={source}
                      type="button"
                      className={`Filter_Chip${filters.source === source ? ' Active' : ''}`}
                      onClick={() => setFilter('source', source)}
                    >
                      {sourceLabel(source)}
                      <small>{count}</small>
                    </button>
                  ))}
                </div>
              </div>

              <div className="Filter_Group">
                <span className="Filter_Label">{t('trading.filterType')}</span>
                <div className="Filter_Chips">
                  <button
                    type="button"
                    className={`Filter_Chip${filters.type === '' ? ' Active' : ''}`}
                    onClick={() => setFilter('type', '')}
                  >
                    {t('trading.filterAll')}
                  </button>
                  {TYPES.map((type) => (
                    <button
                      key={type}
                      type="button"
                      className={`Filter_Chip${filters.type === type ? ' Active' : ''}`}
                      onClick={() => setFilter('type', type)}
                    >
                      {typeLabel(type)}
                      {typeCount(type) !== undefined && <small>{typeCount(type)}</small>}
                    </button>
                  ))}
                </div>
              </div>
            </div>

            <div className="Instrument_Picker_Count">
              {loading ? ' ' : t('trading.resultsCount', { count: total })}
            </div>

            <ul className="Instrument_Picker_List">
              {loading ? (
                <li className="Instrument_Picker_Message">{t('common.loading')}</li>
              ) : instruments.length === 0 ? (
                <li className="Instrument_Picker_Message">{t('common.noResults')}</li>
              ) : (
                instruments.map((instrument) => (
                  <li key={instrument.id}>
                    <button
                      type="button"
                      className={`Instrument_Option${value?.id === instrument.id ? ' Selected' : ''}`}
                      onClick={() => choose(instrument)}
                    >
                      <span className="Instrument_Option_Pair">{instrumentPair(instrument)}</span>
                      <span className="Instrument_Option_Symbol">{instrument.symbol}</span>
                      {instrument.expiresAt && (
                        <span className="Instrument_Option_Expiry">
                          {t('trading.expires', { date: formatDate(instrument.expiresAt) })}
                        </span>
                      )}
                      <span className="Instrument_Type_Badge">{typeLabel(instrument.type)}</span>
                    </button>
                  </li>
                ))
              )}
            </ul>

            {!loading && instruments.length < total && (
              <button
                type="button"
                className="Instrument_Picker_More"
                onClick={loadMore}
                disabled={loadingMore}
              >
                {t('trading.loadMore', { shown: instruments.length, total })}
              </button>
            )}
          </div>,
          document.body,
        )}
    </div>
  );
};

export default Instrument_Picker;

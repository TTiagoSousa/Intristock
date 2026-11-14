import { useEffect, useMemo, useRef, useState } from 'react';
import type { KeyboardEvent } from 'react';
import { useTranslation } from 'react-i18next';
import { Chevron_Left, Chevron_Right, Search } from '../../../../Imports/icons';
import type { Chart_Trade } from '../../../../Hooks/Trading/useSimulationChart';
import type { Entry_Payload } from '../../../../Hooks/Trading/useSimulation';
import { entryLabel, chartExitKeyOf, exitLabel } from '../Trading_Simulator/labels';
import { formatDateTime, formatPct, toneOf } from '../Trading_Simulator/format';
import Trade_Filter from './Trade_Filter';
import { ALL, filterTrades } from './tradeFilter';
import type { Trade_Filter_Value } from './tradeFilter';

// Mais do que isto na lista pesa e ninguém lê: escreve-se para filtrar
const MAX_ROWS = 300;

interface Trade_Picker_Props {
  // Todos: os filtros do painel escolhem os que ficam (também no gráfico)
  trades: Chart_Trade[];
  filter: Trade_Filter_Value;
  onFilterChange: (filter: Trade_Filter_Value) => void;
  entries: Entry_Payload[];
  // O trade marcado no gráfico (o id é o número do trade)
  selectedId: string | null;
  onSelect: (trade: Chart_Trade) => void;
}

/**
 * Ir a um trade sem sair do gráfico: as setas passam ao anterior e ao
 * seguinte; o campo abre um painel com os filtros (entrada e saída, que valem
 * também para o gráfico), a pesquisa (número, data, nome) e a lista. Teclado:
 * ↑ ↓ escolhem, Enter vai, Esc fecha. As setas respeitam os filtros.
 */
const Trade_Picker = ({ trades, entries, filter, onFilterChange, selectedId, onSelect }: Trade_Picker_Props) => {
  const { t, i18n } = useTranslation();
  const language = i18n.language;
  const [open, setOpen] = useState(false);
  const [query, setQuery] = useState('');
  const [active, setActive] = useState(0);
  const rootRef = useRef<HTMLDivElement>(null);
  const listRef = useRef<HTMLDivElement>(null);

  // O texto de cada trade, para a pesquisa: número, nomes e datas
  const rows = useMemo(
    () =>
      filterTrades(trades, filter).map((trade) => {
        const exitKey = chartExitKeyOf(trade);
        const entryName = entryLabel(entries, trade.entryRule, t);
        const exitName = exitLabel(entries, trade.entryRule, exitKey, t);
        const entryDate = formatDateTime(trade.entryTime, language);
        const exitDate = formatDateTime(trade.exitTime, language);
        return {
          trade,
          exitKey,
          entryName,
          exitName,
          entryDate,
          exitDate,
          text: `#${trade.index} ${entryName} ${exitName} ${entryDate} ${exitDate}`.toLowerCase(),
        };
      }),
    [trades, filter, entries, t, language],
  );

  const matches = useMemo(() => {
    const words = query.toLowerCase().split(/\s+/).filter(Boolean);
    if (words.length === 0) return rows;
    return rows.filter((row) =>
      words.every((word) => row.text.includes(word) || String(row.trade.index) === word.replace('#', '')),
    );
  }, [rows, query]);
  const shown = matches.slice(0, MAX_ROWS);

  // Fecha ao clicar fora
  useEffect(() => {
    if (!open) return;
    const onPointer = (event: MouseEvent) => {
      if (!rootRef.current?.contains(event.target as Node)) setOpen(false);
    };
    document.addEventListener('mousedown', onPointer);
    return () => document.removeEventListener('mousedown', onPointer);
  }, [open]);

  // A linha escolhida com o teclado fica sempre à vista
  useEffect(() => {
    listRef.current
      ?.querySelector<HTMLElement>(`[data-row="${active}"]`)
      ?.scrollIntoView({ block: 'nearest' });
  }, [active]);

  // Escolhido, o campo volta a mostrar em que trade se está ("Trade 5 de 29");
  // os filtros ficam
  const choose = (trade: Chart_Trade) => {
    onSelect(trade);
    setOpen(false);
    setQuery('');
    setActive(0);
  };

  // O anterior e o seguinte ao marcado, dentro dos filtros
  const position = rows.findIndex((row) => String(row.trade.index) === selectedId);
  const step = (delta: number) => {
    if (rows.length === 0) return;
    const next =
      position === -1 ? (delta > 0 ? 0 : rows.length - 1) : Math.min(rows.length - 1, Math.max(0, position + delta));
    onSelect(rows[next].trade);
  };

  const onKey = (event: KeyboardEvent<HTMLInputElement>) => {
    if (event.key === 'Escape') {
      setOpen(false);
      return;
    }
    if (!open && (event.key === 'ArrowDown' || event.key === 'Enter')) {
      setOpen(true);
      return;
    }
    if (event.key === 'ArrowDown') {
      event.preventDefault();
      setActive(Math.min(shown.length - 1, active + 1));
    } else if (event.key === 'ArrowUp') {
      event.preventDefault();
      setActive(Math.max(0, active - 1));
    } else if (event.key === 'Enter' && shown[active]) {
      event.preventDefault();
      choose(shown[active].trade);
    }
  };

  // Mudar a pesquisa ou um filtro volta ao primeiro da lista
  const search = (value: string) => {
    setQuery(value);
    setActive(0);
  };

  return (
    <div className="Trade_Picker" ref={rootRef}>
      <button
        type="button"
        className="Trade_Picker_Step"
        onClick={() => step(-1)}
        disabled={rows.length === 0 || position === 0}
        aria-label={t('trading.pickerPrevious')}
        title={t('trading.pickerPrevious')}
      >
        <Chevron_Left />
      </button>

      <div className={`Trade_Picker_Field${open ? ' Open' : ''}`}>
        <Search />
        <input
          type="text"
          value={query}
          placeholder={
            position === -1
              ? t('trading.pickerPlaceholder')
              : t('trading.pickerCurrent', { position: position + 1, total: rows.length })
          }
          onChange={(event) => search(event.target.value)}
          onFocus={() => setOpen(true)}
          onClick={() => setOpen(true)}
          onKeyDown={onKey}
          role="combobox"
          aria-expanded={open}
          aria-controls="trade-picker-list"
          aria-label={t('trading.pickerPlaceholder')}
        />
        {(filter.entry !== ALL || filter.exit !== ALL) && (
          <span className="Trade_Picker_Dot" title={t('trading.pickerFiltered')} />
        )}
      </div>

      <button
        type="button"
        className="Trade_Picker_Step"
        onClick={() => step(1)}
        disabled={rows.length === 0 || position === rows.length - 1}
        aria-label={t('trading.pickerNext')}
        title={t('trading.pickerNext')}
      >
        <Chevron_Right />
      </button>

      {open && (
        <div className="Trade_Picker_Panel">
          <Trade_Filter
            trades={trades}
            entries={entries}
            value={filter}
            onChange={(next) => {
              onFilterChange(next);
              setActive(0);
            }}
          />
          <div className="Trade_Picker_List" id="trade-picker-list" role="listbox" ref={listRef}>
            {shown.length === 0 ? (
              <span className="Trade_Picker_Empty">{t('trading.chartNoTrades')}</span>
            ) : (
              shown.map((row, index) => {
                const { trade } = row;
                const selected = String(trade.index) === selectedId;
                return (
                  <button
                    key={trade.index}
                    type="button"
                    role="option"
                    aria-selected={selected}
                    data-row={index}
                    className={`Trade_Picker_Row${index === active ? ' Active' : ''}${selected ? ' Selected' : ''}`}
                    onMouseEnter={() => setActive(index)}
                    onClick={() => choose(trade)}
                  >
                    <span className="Trade_Picker_Index">#{trade.index}</span>
                    <span className={`Side_Badge ${trade.side}`} title={t(`trading.side_${trade.side}`)}>
                      {row.entryName}
                    </span>
                    <span className="Trade_Picker_Dates">
                      <span>{row.entryDate}</span>
                      <span className="Trade_Picker_Arrow">→</span>
                      <span>{row.exitDate}</span>
                    </span>
                    <span className={`Exit_Badge ${trade.exitReason}`}>{row.exitName}</span>
                    <span className={`Trade_Picker_Pct ${toneOf(trade.pnlPct)}`}>
                      {formatPct(trade.pnlPct, language)}
                    </span>
                  </button>
                );
              })
            )}
          </div>

          <div className="Trade_Picker_Footer">
            <span>
              {matches.length > MAX_ROWS
                ? t('trading.pickerShowing', { shown: MAX_ROWS, total: matches.length })
                : t('trading.chartTrades', { count: matches.length })}
            </span>
            <span className="Trade_Picker_Keys">{t('trading.pickerKeys')}</span>
          </div>
        </div>
      )}
    </div>
  );
};

export default Trade_Picker;

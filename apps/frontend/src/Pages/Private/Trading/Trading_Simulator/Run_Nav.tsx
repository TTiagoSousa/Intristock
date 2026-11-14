import { useEffect, useRef, useState } from 'react';
import { useTranslation } from 'react-i18next';
import { Chevron_Down } from '../../../../Imports/icons';
import type { Run_Tab } from './runTabs';

interface Nav_Item {
  key: Run_Tab;
  label: string;
  count?: number;
}

interface Nav_Group {
  key: string;
  label: string;
  // Sem itens, é um separador simples
  items?: Nav_Item[];
  tab?: Run_Tab;
}

interface Run_Nav_Props {
  tab: Run_Tab;
  onChange: (tab: Run_Tab) => void;
  // Quantos de cada separador do formulário (opções ligadas, indicadores, entradas)
  counts: Partial<Record<Run_Tab, number>>;
  // Separadores com alguma coisa por resolver
  problemTabs: Run_Tab[];
}

/**
 * O menu da página de uma simulação: separadores em linha, alguns com um
 * dropdown dos seus submenus. O grupo de um submenu aberto fica sublinhado.
 */
const Run_Nav = ({ tab, onChange, counts, problemTabs }: Run_Nav_Props) => {
  const { t } = useTranslation();
  const [open, setOpen] = useState<string | null>(null);
  const navRef = useRef<HTMLDivElement>(null);

  // Fecha ao clicar fora ou com o Escape
  useEffect(() => {
    if (!open) return;

    const onPointer = (event: MouseEvent) => {
      if (!navRef.current?.contains(event.target as Node)) setOpen(null);
    };
    const onKey = (event: KeyboardEvent) => {
      if (event.key === 'Escape') setOpen(null);
    };

    document.addEventListener('mousedown', onPointer);
    document.addEventListener('keydown', onKey);
    return () => {
      document.removeEventListener('mousedown', onPointer);
      document.removeEventListener('keydown', onKey);
    };
  }, [open]);

  const groups: Nav_Group[] = [
    {
      key: 'settings',
      label: t('trading.runNav_settings'),
      items: [
        { key: 'general', label: t('trading.tab_general'), count: counts.general },
        { key: 'indicators', label: t('trading.indicators'), count: counts.indicators },
        { key: 'strategy', label: t('trading.tabStrategy'), count: counts.strategy },
        { key: 'rules', label: t('trading.tab_rules'), count: counts.rules },
      ],
    },
    { key: 'summary', label: t('trading.runNav_summary'), tab: 'summary' },
    { key: 'chart', label: t('trading.runNav_chart'), tab: 'chart' },
  ];

  const choose = (next: Run_Tab) => {
    onChange(next);
    setOpen(null);
  };

  return (
    <div className="Run_Nav" role="tablist" ref={navRef}>
      {groups.map((group) => {
        if (!group.items) {
          return (
            <button
              key={group.key}
              type="button"
              role="tab"
              aria-selected={tab === group.tab}
              className={`Run_Nav_Tab${tab === group.tab ? ' Active' : ''}`}
              onClick={() => group.tab && choose(group.tab)}
            >
              {group.label}
            </button>
          );
        }

        const active = group.items.some((item) => item.key === tab);
        const problem = group.items.some((item) => problemTabs.includes(item.key));

        return (
          <div key={group.key} className="Run_Nav_Group">
            <button
              type="button"
              aria-haspopup="menu"
              aria-expanded={open === group.key}
              className={`Run_Nav_Tab${active ? ' Active' : ''}${problem ? ' Has_Problem' : ''}`}
              onClick={() => setOpen(open === group.key ? null : group.key)}
            >
              {group.label}
              <span className={`Run_Nav_Chevron${open === group.key ? ' Open' : ''}`}>
                <Chevron_Down />
              </span>
            </button>

            {open === group.key && (
              <div className="Run_Nav_Menu" role="menu">
                {group.items.map((item) => (
                  <button
                    key={item.key}
                    type="button"
                    role="menuitem"
                    className={`Run_Nav_Item${tab === item.key ? ' Active' : ''}${problemTabs.includes(item.key) ? ' Has_Problem' : ''}`}
                    onClick={() => choose(item.key)}
                  >
                    <span>{item.label}</span>
                    {item.count ? <span className="Sim_Tab_Count">{item.count}</span> : null}
                  </button>
                ))}
              </div>
            )}
          </div>
        );
      })}
    </div>
  );
};

export default Run_Nav;

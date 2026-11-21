import { Fragment, useEffect, useId, useLayoutEffect, useRef, useState } from 'react';
import type { KeyboardEvent as React_Keyboard_Event } from 'react';
import { createPortal } from 'react-dom';
import { useTranslation } from 'react-i18next';
import { Chevron_Down, Search } from '../../../Imports/icons';
import './Global_Dropdown.scss';

interface Global_Dropdown_Option {
  value: string | number;
  label: string;
  // Opções com grupo ficam depois de uma divisória com este nome. As sem grupo
  // vêm primeiro e sem divisória (os itens do fornecedor, antes dos outros).
  group?: string;
}

interface Global_Dropdown_Props {
  id?: string;
  value?: string | number;
  onChange?: (value: string | number) => void;
  options: Global_Dropdown_Option[];
  placeholder?: string;
  disabled?: boolean;
  maxVisibleOptions?: number;
  // Por defeito a pesquisa aparece sozinha quando há muitas opções.
  // Passar true/false força um dos comportamentos.
  searchable?: boolean;
  // Ação fixa no fundo do painel ("+ Novo fornecedor"). Fica fora da lista, para
  // continuar à vista quando a pesquisa não encontra nada
  action?: { label: string; onClick: () => void };
}

// Altura exata de cada <li> (padding + linha + gap). O padding do painel fica
// de fora da conta, senão sobrava meia opção cortada no fundo da lista.
const OPTION_HEIGHT = 34;


// A partir daqui a lista é grande o suficiente para valer a pena pesquisar
const SEARCHABLE_THRESHOLD = 8;

// Quanto tempo as letras escritas seguidas contam como uma só procura
const TYPEAHEAD_MS = 500;

// Ignora acentos e maiúsculas, para "acores" encontrar "Açores"
const normalize = (value: string) =>
  value
    .normalize('NFD')
    .replace(/[̀-ͯ]/g, '')
    .toLowerCase();

/**
 * O seletor dos formulários: um botão que abre uma lista (`listbox`). Pelo
 * teclado: as setas, Home/End, Enter/Espaço para escolher, Esc para fechar (só
 * o dropdown, não o popover onde está) e as letras saltam para a opção.
 */
const Global_Dropdown = ({
  id,
  value,
  onChange,
  options,
  placeholder,
  disabled,
  maxVisibleOptions = 5,
  searchable,
  action,
}: Global_Dropdown_Props) => {
  const [open, setOpen] = useState(false);
  const [search, setSearch] = useState('');
  const [active, setActive] = useState(-1);
  const [position, setPosition] = useState({ top: 0, left: 0, width: 0 });
  const fieldRef = useRef<HTMLDivElement>(null);
  const triggerRef = useRef<HTMLButtonElement>(null);
  const panelRef = useRef<HTMLDivElement>(null);
  const searchRef = useRef<HTMLInputElement>(null);
  const typeahead = useRef({ text: '', at: 0 });
  const baseId = useId();
  const listId = `${baseId}-list`;
  const optionId = (index: number) => `${baseId}-option-${index}`;

  const { t } = useTranslation();

  const isSearchable = searchable ?? options.length > SEARCHABLE_THRESHOLD;

  const updatePosition = () => {
    if (!fieldRef.current) return;
    const rect = fieldRef.current.getBoundingClientRect();
    setPosition({ top: rect.bottom + 6, left: rect.left, width: rect.width });
  };

  useLayoutEffect(() => {
    if (open) updatePosition();
  }, [open]);

  // Cada abertura começa com a pesquisa limpa e o cursor lá dentro
  useEffect(() => {
    if (!open) {
      setSearch('');
      return;
    }

    if (isSearchable) searchRef.current?.focus();
  }, [open, isSearchable]);

  useEffect(() => {
    if (!open) return;

    const handleClickOutside = (e: MouseEvent) => {
      const target = e.target as Node;
      if (fieldRef.current?.contains(target) || panelRef.current?.contains(target)) return;
      setOpen(false);
    };

    // Com o foco fora do campo (depois de usar a barra da lista), o Esc ainda fecha
    const handleEscape = (e: KeyboardEvent) => {
      if (e.key !== 'Escape' || e.defaultPrevented) return;
      const focused = document.activeElement;
      if (focused === triggerRef.current || focused === searchRef.current) return;
      setOpen(false);
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

  // Comparação por texto: há sítios que guardam o valor como string ("12") e
  // declaram a opção como número (12). Com === o gatilho ficava vazio depois
  // de escolher, como acontecia na capitalização dos juros compostos.
  const selectedOption = options.find((option) => String(option.value) === String(value));

  const visibleOptions = search
    ? options.filter((option) => normalize(option.label).includes(normalize(search)))
    : options;

  // A ativa fica sempre à vista na lista
  useEffect(() => {
    if (!open || active < 0) return;
    document.getElementById(optionId(active))?.scrollIntoView({ block: 'nearest' });
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [active, open]);

  const openList = (at?: 'first' | 'last') => {
    const selected = visibleOptions.findIndex((option) => String(option.value) === String(value));
    setActive(at === 'last' ? options.length - 1 : at === 'first' || selected < 0 ? 0 : selected);
    setOpen(true);
  };

  const close = (refocus: boolean) => {
    setOpen(false);
    setActive(-1);
    if (refocus) triggerRef.current?.focus();
  };

  const choose = (option: Global_Dropdown_Option) => {
    onChange?.(option.value);
    close(true);
  };

  // As letras escritas seguidas procuram a opção que começa por elas
  const jumpTo = (key: string) => {
    const now = Date.now();
    const text = now - typeahead.current.at > TYPEAHEAD_MS ? key : typeahead.current.text + key;
    typeahead.current = { text, at: now };
    const wanted = normalize(text);
    const start = text.length === 1 ? active + 1 : Math.max(active, 0);
    const ordered = [...visibleOptions.slice(start), ...visibleOptions.slice(0, start)];
    const found = ordered.find((option) => normalize(option.label).startsWith(wanted));
    if (!found) return;
    const index = visibleOptions.indexOf(found);
    if (open) setActive(index);
    else onChange?.(found.value);
  };

  const handleKeyDown = (e: React_Keyboard_Event<HTMLElement>) => {
    const fromSearch = e.target === searchRef.current;
    const last = visibleOptions.length - 1;

    if (!open) {
      if (['ArrowDown', 'ArrowUp', 'Enter', ' '].includes(e.key)) {
        e.preventDefault();
        openList(e.key === 'ArrowUp' ? 'last' : undefined);
      } else if (e.key.length === 1 && !e.ctrlKey && !e.metaKey && !e.altKey && !isSearchable) {
        jumpTo(e.key);
      }
      return;
    }

    switch (e.key) {
      case 'Escape':
        // Só fecha o dropdown: o popover à volta não deve receber o Esc
        e.preventDefault();
        e.stopPropagation();
        close(true);
        return;
      case 'Tab':
        if (fromSearch) {
          e.preventDefault();
          close(true);
        } else {
          close(false);
        }
        return;
      case 'ArrowDown':
        e.preventDefault();
        setActive((current) => Math.min(current + 1, last));
        return;
      case 'ArrowUp':
        e.preventDefault();
        setActive((current) => Math.max(current - 1, 0));
        return;
      case 'Home':
        if (fromSearch) return;
        e.preventDefault();
        setActive(0);
        return;
      case 'End':
        if (fromSearch) return;
        e.preventDefault();
        setActive(last);
        return;
      case 'Enter':
        e.preventDefault();
        if (visibleOptions[active]) choose(visibleOptions[active]);
        return;
      case ' ':
        if (fromSearch) return;
        e.preventDefault();
        if (visibleOptions[active]) choose(visibleOptions[active]);
        return;
      default:
        if (!fromSearch && e.key.length === 1 && !e.ctrlKey && !e.metaKey && !e.altKey) jumpTo(e.key);
    }
  };

  const activeId = open && active >= 0 && visibleOptions[active] ? optionId(active) : undefined;

  return (
    <div
      className={`Dropdown_Field${open ? ' Open' : ''}${disabled ? ' Disabled' : ''}${selectedOption ? '' : ' Empty'}`}
      ref={fieldRef}
    >
      <button
        id={id}
        ref={triggerRef}
        type="button"
        className="Dropdown_Field_Trigger"
        disabled={disabled}
        aria-haspopup="listbox"
        aria-expanded={open}
        aria-controls={open ? listId : undefined}
        aria-activedescendant={isSearchable ? undefined : activeId}
        onClick={() => (open ? close(false) : openList())}
        onKeyDown={handleKeyDown}
        // O Espaço já abriu ou escolheu no keydown: o clique do keyup voltava a fechar
        onKeyUp={(e) => e.key === ' ' && e.preventDefault()}
      >
        <span>{selectedOption ? selectedOption.label : placeholder}</span>
        <Chevron_Down />
      </button>

      {open &&
        createPortal(
          <div
            className="Dropdown_Field_Panel"
            ref={panelRef}
            style={{ top: position.top, left: position.left, width: position.width }}
          >
            {isSearchable && (
              <div className="Dropdown_Field_Search">
                <Search />
                <input
                  ref={searchRef}
                  type="text"
                  value={search}
                  onChange={(e) => {
                    setSearch(e.target.value);
                    // A opção ativa acompanha a pesquisa: a primeira que ficou à vista
                    setActive(0);
                  }}
                  onKeyDown={handleKeyDown}
                  placeholder={t('common.search')}
                  aria-label={t('common.search')}
                  aria-controls={listId}
                  aria-activedescendant={activeId}
                  role="combobox"
                  aria-expanded
                  aria-autocomplete="list"
                />
              </div>
            )}

            <ul
              id={listId}
              role="listbox"
              aria-labelledby={id}
              className="Dropdown_Field_Options"
              style={{ maxHeight: maxVisibleOptions * OPTION_HEIGHT }}
            >
              {visibleOptions.length === 0 ? (
                <li className="No_Results" role="presentation">
                  {t('common.noResults')}
                </li>
              ) : (
                visibleOptions.map((option, index) => {
                  const selected = String(option.value) === String(value);
                  return (
                    <Fragment key={option.value}>
                      {/* A divisória só aparece onde o grupo muda — com a pesquisa
                          a esconder um dos lados, não fica uma linha sozinha */}
                      {option.group && option.group !== visibleOptions[index - 1]?.group && (
                        <li className="Group_Divider" role="presentation" aria-hidden="true">
                          {option.group}
                        </li>
                      )}
                      <li
                        id={optionId(index)}
                        role="option"
                        aria-selected={selected}
                        className={`${selected ? 'Selected' : ''}${index === active ? ' Active' : ''}`.trim()}
                        // O clique não tira o foco do botão (ou da pesquisa)
                        onMouseDown={(e) => e.preventDefault()}
                        onMouseMove={() => index !== active && setActive(index)}
                        onClick={() => choose(option)}
                      >
                        {option.label}
                      </li>
                    </Fragment>
                  );
                })
              )}
            </ul>

            {action && (
              <button
                type="button"
                className="Dropdown_Field_Action"
                onClick={() => {
                  close(false);
                  action.onClick();
                }}
              >
                {action.label}
              </button>
            )}
          </div>,
          document.body,
        )}
    </div>
  );
};

export default Global_Dropdown;

import { Fragment, useEffect, useLayoutEffect, useRef, useState } from 'react';
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

// Ignora acentos e maiúsculas, para "acores" encontrar "Açores"
const normalize = (value: string) =>
  value
    .normalize('NFD')
    .replace(/[̀-ͯ]/g, '')
    .toLowerCase();

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
  const [position, setPosition] = useState({ top: 0, left: 0, width: 0 });
  const fieldRef = useRef<HTMLDivElement>(null);
  const panelRef = useRef<HTMLDivElement>(null);
  const searchRef = useRef<HTMLInputElement>(null);

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

  // Comparação por texto: há sítios que guardam o valor como string ("12") e
  // declaram a opção como número (12). Com === o gatilho ficava vazio depois
  // de escolher, como acontecia na capitalização dos juros compostos.
  const selectedOption = options.find((option) => String(option.value) === String(value));

  const visibleOptions = search
    ? options.filter((option) => normalize(option.label).includes(normalize(search)))
    : options;

  return (
    <div
      className={`Dropdown_Field${open ? ' Open' : ''}${disabled ? ' Disabled' : ''}${selectedOption ? '' : ' Empty'}`}
      ref={fieldRef}
    >
      <button
        id={id}
        type="button"
        className="Dropdown_Field_Trigger"
        disabled={disabled}
        onClick={() => setOpen((prev) => !prev)}
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
                  onChange={(e) => setSearch(e.target.value)}
                  placeholder={t('common.search')}
                />
              </div>
            )}

            <ul
              className="Dropdown_Field_Options"
              style={{ maxHeight: maxVisibleOptions * OPTION_HEIGHT }}
            >
              {visibleOptions.length === 0 ? (
                <li className="No_Results">{t('common.noResults')}</li>
              ) : (
                visibleOptions.map((option, index) => (
                  <Fragment key={option.value}>
                    {/* A divisória só aparece onde o grupo muda — com a pesquisa
                        a esconder um dos lados, não fica uma linha sozinha */}
                    {option.group && option.group !== visibleOptions[index - 1]?.group && (
                      <li className="Group_Divider" aria-hidden="true">
                        {option.group}
                      </li>
                    )}
                    <li
                      className={String(option.value) === String(value) ? 'Selected' : ''}
                      onClick={() => {
                        onChange?.(option.value);
                        setOpen(false);
                      }}
                    >
                      {option.label}
                    </li>
                  </Fragment>
                ))
              )}
            </ul>

            {action && (
              <button
                type="button"
                className="Dropdown_Field_Action"
                onClick={() => {
                  setOpen(false);
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

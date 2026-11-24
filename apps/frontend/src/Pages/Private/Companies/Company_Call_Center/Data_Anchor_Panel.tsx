import { useEffect, useLayoutEffect, useRef, useState, type ReactNode } from 'react';
import { createPortal } from 'react-dom';

const GAP = 6;
const MARGIN = 12;

// As listas do Global_Dropdown abrem num portal: um clique ou um scroll lá dentro não fecha o painel
const insideDropdown = (target: EventTarget | null) => target instanceof Element && Boolean(target.closest('.Dropdown_Field_Panel'));

/**
 * Um painel por cima da página preso a um botão (o «Info» de uma linha, as colunas, um
 * filtro): por baixo dele, encostado à direita, ou por cima sem espaço em baixo. Fecha
 * com um clique fora, o Esc, um scroll da página ou ao mudar o tamanho da janela.
 */
const Data_Anchor_Panel = ({
  anchor,
  onClose,
  label,
  className = '',
  align = 'right',
  children,
}: {
  anchor: HTMLElement;
  onClose: () => void;
  label: string;
  className?: string;
  align?: 'left' | 'right';
  children: ReactNode;
}) => {
  const panelRef = useRef<HTMLDivElement>(null);
  const [position, setPosition] = useState<{ top: number; left: number } | null>(null);
  const closeRef = useRef(onClose);
  useEffect(() => {
    closeRef.current = onClose;
  }, [onClose]);

  useLayoutEffect(() => {
    const panel = panelRef.current;
    if (!panel) return;
    const place = () => {
      const box = anchor.getBoundingClientRect();
      const size = panel.getBoundingClientRect();
      const below = box.bottom + GAP;
      const top = below + size.height > window.innerHeight - MARGIN ? Math.max(MARGIN, box.top - GAP - size.height) : below;
      const wanted = align === 'right' ? box.right - size.width : box.left;
      const left = Math.min(Math.max(MARGIN, wanted), window.innerWidth - size.width - MARGIN);
      setPosition((previous) => (previous && previous.top === top && previous.left === left ? previous : { top, left }));
    };
    place();
    // O conteúdo muda de tamanho (outra condição, mais filtros): volta a ver onde cabe
    const observer = new ResizeObserver(place);
    observer.observe(panel);
    return () => observer.disconnect();
  }, [anchor, align]);

  useEffect(() => {
    const close = (refocus: boolean) => {
      closeRef.current();
      if (refocus) anchor.focus();
    };
    const onPointer = (event: PointerEvent) => {
      const target = event.target as Node;
      if (panelRef.current?.contains(target) || anchor.contains(target) || insideDropdown(event.target)) return;
      close(false);
    };
    const onKey = (event: KeyboardEvent) => {
      // O Esc fecha primeiro a lista aberta de um campo, depois o painel
      if (event.key !== 'Escape' || document.querySelector('.Dropdown_Field_Panel')) return;
      close(Boolean(panelRef.current?.contains(document.activeElement)) || document.activeElement === anchor);
    };
    const onScroll = (event: Event) => {
      if (panelRef.current?.contains(event.target as Node) || insideDropdown(event.target)) return;
      close(false);
    };
    const onResize = () => close(false);
    document.addEventListener('pointerdown', onPointer);
    document.addEventListener('keydown', onKey);
    window.addEventListener('scroll', onScroll, true);
    window.addEventListener('resize', onResize);
    return () => {
      document.removeEventListener('pointerdown', onPointer);
      document.removeEventListener('keydown', onKey);
      window.removeEventListener('scroll', onScroll, true);
      window.removeEventListener('resize', onResize);
    };
  }, [anchor]);

  return createPortal(
    <div
      ref={panelRef}
      className={`Call_Center_Panel ${className}`.trim()}
      role="dialog"
      aria-label={label}
      style={position ? { top: position.top, left: position.left } : { top: 0, left: 0, visibility: 'hidden' }}
      // Num portal os eventos do React sobem ao componente que o abriu: dentro de um popover (as definições de uma
      // secção das Leads) o Esc, o Tab e o submit do filtro não chegam ao popover nem ao formulário dele
      // (o stopPropagation do React também para o nativo, por isso o Esc de dentro fecha-se aqui)
      onKeyDown={(event) => {
        event.stopPropagation();
        if (event.key !== 'Escape' || event.defaultPrevented || document.querySelector('.Dropdown_Field_Panel')) return;
        closeRef.current();
        anchor.focus();
      }}
      onSubmit={(event) => event.stopPropagation()}
    >
      {children}
    </div>,
    document.body,
  );
};

export default Data_Anchor_Panel;

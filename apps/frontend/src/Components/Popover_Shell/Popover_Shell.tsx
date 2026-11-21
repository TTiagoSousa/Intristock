import { useEffect, useId, useLayoutEffect, useRef } from 'react';
import type {
  FormEventHandler,
  KeyboardEvent as React_Keyboard_Event,
  MouseEvent as React_Mouse_Event,
  ReactNode,
  RefObject,
} from 'react';

interface Popover_Shell_Props {
  onClose: () => void;
  children: ReactNode;
  // As classes a mais do cartão (`Narrow`, `Wide`…)
  className?: string;
  // As classes a mais do fundo (`Stacked`, um popover por cima de outro)
  backdropClassName?: string;
  // Com o formulário mexido o clique no fundo não fecha (o Esc e o × fecham).
  // Sem ele, o shell vê sozinho quando se escreve ou escolhe alguma coisa.
  dirty?: boolean;
  // O fundo nunca fecha (um passo que não se pode largar a meio)
  closeOnBackdrop?: boolean;
  // O Esc não fecha (o mesmo passo que não se larga)
  closeOnEscape?: boolean;
  // O id do título; sem ele, o `.Popover_Title` do cabeçalho
  labelledBy?: string;
  // O cartão é o <form> (o Enter grava)
  as?: 'div' | 'form';
  onSubmit?: FormEventHandler<HTMLFormElement>;
  noValidate?: boolean;
  // Só o fundo: o `.Popover_Card` vem dos filhos (um popover com passos, em
  // que cada passo é o seu cartão); a semântica põe-se nele
  bare?: boolean;
}

const FOCUSABLE =
  'a[href], button:not([disabled]), input:not([disabled]):not([type="hidden"]), select:not([disabled]), ' +
  'textarea:not([disabled]), [tabindex]:not([tabindex="-1"]), [contenteditable="true"]';

const focusablesIn = (root: HTMLElement) =>
  Array.from(root.querySelectorAll<HTMLElement>(FOCUSABLE)).filter((element) => element.getClientRects().length > 0);

/**
 * O fundo e o cartão de todos os popovers (as classes do `Popover.scss`), com a
 * semântica de um diálogo: `role="dialog"`, `aria-modal`, o título como nome,
 * o foco preso lá dentro (Tab e Shift+Tab dão a volta), o foco no cartão ao
 * abrir (ou no campo com `autoFocus`) e de volta a quem o abriu ao fechar, e o
 * Esc. O Esc de um dropdown lá dentro só fecha o dropdown. O clique no fundo
 * fecha, menos com o formulário mexido.
 */
const Popover_Shell = ({
  onClose,
  children,
  className,
  backdropClassName,
  dirty,
  closeOnBackdrop = true,
  closeOnEscape = true,
  labelledBy,
  as = 'div',
  onSubmit,
  noValidate,
  bare = false,
}: Popover_Shell_Props) => {
  const backdropRef = useRef<HTMLDivElement>(null);
  const cardRef = useRef<HTMLElement>(null);
  const touched = useRef(false);
  const pressedBackdrop = useRef(false);
  const generatedId = useId();
  const titleId = labelledBy ?? `${generatedId}-title`;

  const getCard = () =>
    bare ? (backdropRef.current?.querySelector<HTMLElement>(':scope > .Popover_Card') ?? null) : cardRef.current;

  // O título do cabeçalho passa a ser o nome do diálogo (e, sem cartão próprio,
  // o cartão dos filhos fica com a semântica, a cada passo)
  useLayoutEffect(() => {
    const card = getCard();
    if (!card) return;
    if (bare) {
      card.setAttribute('role', 'dialog');
      card.setAttribute('aria-modal', 'true');
      card.setAttribute('aria-labelledby', titleId);
      if (!card.hasAttribute('tabindex')) card.tabIndex = -1;
    }
    // O elemento com o foco saiu (outro passo, um botão que desapareceu): volta ao cartão
    if (document.activeElement === document.body) card.focus({ preventScroll: true });
    if (labelledBy) return;
    const title = card.querySelector<HTMLElement>('.Popover_Title');
    if (title && !title.id) title.id = titleId;
  });

  // Ao abrir, o foco entra no cartão (se nenhum campo o pediu com autoFocus);
  // ao fechar, volta a quem o abriu
  useEffect(() => {
    const card = getCard();
    const opener = document.activeElement as HTMLElement | null;
    if (card && !card.contains(document.activeElement)) card.focus({ preventScroll: true });
    return () => {
      if (opener && opener !== document.body && document.contains(opener)) opener.focus({ preventScroll: true });
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  const handleKeyDown = (e: React_Keyboard_Event<HTMLElement>) => {
    const card = getCard();
    if (!card) return;

    if (e.key === 'Escape') {
      // Já tratado por quem está lá dentro (um dropdown aberto)
      if (e.defaultPrevented) return;
      e.preventDefault();
      e.stopPropagation();
      if (closeOnEscape) onClose();
      return;
    }

    if (e.key !== 'Tab') return;
    // Um popover por cima deste trata do seu Tab
    e.stopPropagation();
    if (e.defaultPrevented) return;
    const items = focusablesIn(card);
    if (items.length === 0) {
      e.preventDefault();
      card.focus();
      return;
    }
    const first = items[0];
    const last = items[items.length - 1];
    const current = document.activeElement;
    if (e.shiftKey && (current === first || current === card || !card.contains(current))) {
      e.preventDefault();
      last.focus();
    } else if (!e.shiftKey && (current === last || !card.contains(current))) {
      e.preventDefault();
      first.focus();
    }
  };

  // Escrever num campo ou escolher uma opção de um dropdown conta como mexer
  const markTouched = () => {
    touched.current = true;
  };
  const handleClickCapture = (e: React_Mouse_Event<HTMLElement>) => {
    if ((e.target as HTMLElement).closest?.('[role="option"]')) touched.current = true;
  };

  // Só fecha um clique que começou e acabou no fundo (arrastar o texto de um
  // campo para fora não fecha), e nunca com o formulário mexido
  const handleBackdropMouseDown = (e: React_Mouse_Event<HTMLDivElement>) => {
    pressedBackdrop.current = e.target === e.currentTarget;
    // O foco não sai do cartão
    if (pressedBackdrop.current) e.preventDefault();
  };
  const handleBackdropClick = (e: React_Mouse_Event<HTMLDivElement>) => {
    const fromBackdrop = pressedBackdrop.current && e.target === e.currentTarget;
    pressedBackdrop.current = false;
    if (!fromBackdrop) {
      // Sem cartão próprio, o clique dentro do cartão dos filhos não sobe
      if (bare) e.stopPropagation();
      return;
    }
    if (!closeOnBackdrop) return;
    if (dirty ?? touched.current) return;
    onClose();
  };

  const backdropClass = `Popover_Backdrop${backdropClassName ? ` ${backdropClassName}` : ''}`;

  if (bare) {
    return (
      <div
        ref={backdropRef}
        className={backdropClass}
        onMouseDown={handleBackdropMouseDown}
        onClick={handleBackdropClick}
        onKeyDown={handleKeyDown}
        onInputCapture={markTouched}
        onClickCapture={handleClickCapture}
      >
        {children}
      </div>
    );
  }

  const card = {
    className: `Popover_Card${className ? ` ${className}` : ''}`,
    role: 'dialog',
    'aria-modal': true,
    'aria-labelledby': titleId,
    tabIndex: -1,
    onClick: (e: React_Mouse_Event<HTMLElement>) => e.stopPropagation(),
    onKeyDown: handleKeyDown,
    onInputCapture: markTouched,
    onClickCapture: handleClickCapture,
    children,
  };

  return (
    <div
      ref={backdropRef}
      className={backdropClass}
      onMouseDown={handleBackdropMouseDown}
      onClick={handleBackdropClick}
    >
      {as === 'form' ? (
        <form {...card} ref={cardRef as RefObject<HTMLFormElement>} onSubmit={onSubmit} noValidate={noValidate} />
      ) : (
        <div {...card} ref={cardRef as RefObject<HTMLDivElement>} />
      )}
    </div>
  );
};

export default Popover_Shell;

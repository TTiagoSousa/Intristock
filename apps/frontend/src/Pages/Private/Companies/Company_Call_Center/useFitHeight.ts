import { useEffect, useState } from 'react';

/// Abaixo disto a tabela deixa de encolher (num ecrã baixo a página volta a fazer scroll)
const MIN_HEIGHT = 240;

/**
 * Uma tabela que ocupa o que sobra do ecrã até ao fundo, com o scroll dela (o que está por baixo — a paginação, as
 * margens — continua à vista): a altura máxima é a janela menos o que está por cima e o que está por baixo dela.
 * Refaz-se ao mudar o tamanho da janela ou da página (os filtros, as linhas). Com `height` fica com essa altura (o
 * quadro das Leads, para as colunas caberem nele).
 */
export function useFitHeight<T extends HTMLElement>(property: 'maxHeight' | 'height' = 'maxHeight') {
  // Um ref de função: o elemento pode aparecer depois (quando os dados chegam)
  const [element, setElement] = useState<T | null>(null);

  useEffect(() => {
    if (!element) return;
    let frame = 0;
    const fit = () => {
      cancelAnimationFrame(frame);
      frame = requestAnimationFrame(() => {
        const box = element.getBoundingClientRect();
        const top = box.top + window.scrollY;
        // O que está por baixo até ao fim do conteúdo da página (não da altura mínima dela, senão encolhia sempre)
        const view = element.closest<HTMLElement>('.Workspace_View, .Shell_View');
        const below = view ? view.getBoundingClientRect().bottom - box.bottom : document.documentElement.scrollHeight - (box.bottom + window.scrollY);
        const max = Math.max(MIN_HEIGHT, Math.floor(window.innerHeight - top - Math.max(0, below)));
        element.style[property] = `${max}px`;
      });
    };
    fit();
    const observer = new ResizeObserver(fit);
    observer.observe(document.body);
    window.addEventListener('resize', fit);
    return () => {
      cancelAnimationFrame(frame);
      observer.disconnect();
      window.removeEventListener('resize', fit);
    };
  }, [element, property]);

  return setElement;
}

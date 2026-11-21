import type { KeyboardEvent } from 'react';

// Uma linha de tabela (ou outro elemento) que abre com um clique também abre
// pelo teclado: Enter ou Espaço com o foco nela (não num botão lá dentro)
export const activateOnKey = (event: KeyboardEvent<HTMLElement>) => {
  if (event.target !== event.currentTarget) return;
  if (event.key !== 'Enter' && event.key !== ' ') return;
  event.preventDefault();
  event.currentTarget.click();
};

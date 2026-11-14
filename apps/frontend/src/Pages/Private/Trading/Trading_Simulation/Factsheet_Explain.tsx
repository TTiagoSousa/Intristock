import { useEffect, useRef, useState } from 'react';
import { createPortal } from 'react-dom';
import { useTranslation } from 'react-i18next';
import { Close } from '../../../../Imports/icons';

interface Factsheet_Explain_Props {
  // A chave dos textos: trading.fsExplain_<id>_what, _read, _pros e _cons
  id: string;
  // O nome do que se explica (o título do cartão, do gráfico ou da tabela)
  title?: string;
  // Uma frase curta antes do resto (a ajuda antiga dos cartões)
  summary?: string;
}

// As linhas dos prós e dos contras vêm separadas por \n
const lines = (text: string) =>
  text
    .split('\n')
    .map((line) => line.trim())
    .filter(Boolean);

/**
 * O "?" de um cartão, gráfico ou tabela: ao clicar abre a explicação ao centro
 * do ecrã, com a página escurecida e parada por trás — o que é, como se lê e o
 * que diz e, onde fazem falta, os prós e os contras lado a lado. Vai para o `body` (os painéis
 * cortam o que sai deles); o ✕, o Esc ou um clique no fundo fecham, e o foco
 * volta ao "?".
 */
const Factsheet_Explain = ({ id, title, summary }: Factsheet_Explain_Props) => {
  const { t, i18n } = useTranslation();
  const [open, setOpen] = useState(false);
  const buttonRef = useRef<HTMLButtonElement>(null);
  const panelRef = useRef<HTMLDivElement>(null);

  const key = (part: string) => `trading.fsExplain_${id}_${part}`;
  const has = i18n.exists(key('what'));

  useEffect(() => {
    if (!open) return;
    const button = buttonRef.current;
    const escape = (event: KeyboardEvent) => {
      if (event.key === 'Escape') {
        event.stopPropagation();
        setOpen(false);
      }
    };
    // Em captura, para o Esc não fechar também um painel em ecrã inteiro por baixo
    window.addEventListener('keydown', escape, true);
    // Quem faz scroll é o <html> (o overflow do body não chega lá)
    const root = document.documentElement;
    const overflow = root.style.overflow;
    root.style.overflow = 'hidden';
    panelRef.current?.focus();
    return () => {
      window.removeEventListener('keydown', escape, true);
      root.style.overflow = overflow;
      button?.focus();
    };
  }, [open]);

  if (!has) return null;

  const label = t('trading.fsExplainOpen', { title: title ?? '' });
  // Os prós e os contras só existem onde fazem falta (há explicações sem eles, ou só com os contras)
  const pros = i18n.exists(key('pros')) ? lines(t(key('pros'))) : [];
  const cons = i18n.exists(key('cons')) ? lines(t(key('cons'))) : [];

  return (
    <>
      <button
        type="button"
        ref={buttonRef}
        className={`Factsheet_Explain${open ? ' Open' : ''}`}
        onClick={(event) => {
          // Dentro de um botão ou de uma linha clicável, o "?" não faz o resto
          event.stopPropagation();
          setOpen(true);
        }}
        aria-label={label}
        title={label}
        aria-haspopup="dialog"
      >
        ?
      </button>
      {open &&
        createPortal(
          <div
            className="Factsheet_Explain_Backdrop"
            onMouseDown={(event) => event.target === event.currentTarget && setOpen(false)}
          >
            <div
              ref={panelRef}
              className="Factsheet_Explain_Dialog"
              role="dialog"
              aria-modal="true"
              aria-label={title ?? label}
              tabIndex={-1}
            >
              <div className="Factsheet_Explain_Head">
                <span className="Factsheet_Explain_Badge" aria-hidden="true">
                  ?
                </span>
                <strong className="Factsheet_Explain_Title">{title}</strong>
                <button
                  type="button"
                  className="Factsheet_Explain_Close"
                  onClick={() => setOpen(false)}
                  aria-label={t('trading.fsExplainClose')}
                  title={t('trading.fsExplainClose')}
                >
                  <Close />
                </button>
              </div>

              {summary && <p className="Factsheet_Explain_Summary">{summary}</p>}

              <section className="Factsheet_Explain_Section">
                <span className="Factsheet_Explain_Heading">{t('trading.fsExplainWhat')}</span>
                <p>{t(key('what'))}</p>
              </section>
              <section className="Factsheet_Explain_Section">
                <span className="Factsheet_Explain_Heading">{t('trading.fsExplainRead')}</span>
                <p>{t(key('read'))}</p>
              </section>

              {(pros.length > 0 || cons.length > 0) && (
                <div className={`Factsheet_Explain_Columns${pros.length && cons.length ? '' : ' Single'}`}>
                  {pros.length > 0 && (
                    <section className="Factsheet_Explain_List Positive">
                      <span className="Factsheet_Explain_Heading">{t('trading.fsExplainPros')}</span>
                      <ul>
                        {pros.map((line) => (
                          <li key={line}>{line}</li>
                        ))}
                      </ul>
                    </section>
                  )}
                  {cons.length > 0 && (
                    <section className="Factsheet_Explain_List Negative">
                      <span className="Factsheet_Explain_Heading">{t('trading.fsExplainCons')}</span>
                      <ul>
                        {cons.map((line) => (
                          <li key={line}>{line}</li>
                        ))}
                      </ul>
                    </section>
                  )}
                </div>
              )}
            </div>
          </div>,
          document.body,
        )}
    </>
  );
};

export default Factsheet_Explain;

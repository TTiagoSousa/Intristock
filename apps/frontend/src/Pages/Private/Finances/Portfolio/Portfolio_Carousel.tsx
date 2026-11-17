import { useCallback, useEffect, useRef, useState, type ReactNode } from 'react';
import { useTranslation } from 'react-i18next';
import * as Icon from '../../../../Imports/icons';

/**
 * Os cartões dos portefólios numa fila que anda com as setas (uma página de cada vez).
 * As setas ficam antes dos cartões e apagam-se quando já não há mais para esse lado.
 */
const Portfolio_Carousel = ({ children }: { children: ReactNode }) => {
  const { t } = useTranslation();
  const track = useRef<HTMLDivElement>(null);
  const [edges, setEdges] = useState({ start: true, end: true });

  const measure = useCallback(() => {
    const element = track.current;
    if (!element) return;
    setEdges({
      start: element.scrollLeft <= 1,
      end: element.scrollLeft + element.clientWidth >= element.scrollWidth - 1,
    });
  }, []);

  useEffect(() => {
    measure();
    const element = track.current;
    if (!element) return;
    const observer = new ResizeObserver(measure);
    observer.observe(element);
    return () => observer.disconnect();
  }, [measure, children]);

  const move = (direction: 1 | -1) => {
    const element = track.current;
    if (element) element.scrollBy({ left: direction * element.clientWidth * 0.9, behavior: 'smooth' });
  };

  return (
    <div className="Portfolio_Carousel">
      <div className="Portfolio_Carousel_Arrows">
        <button
          type="button"
          className="Icon_Button"
          onClick={() => move(-1)}
          disabled={edges.start}
          aria-label={t('portfolio.previous')}
          title={t('portfolio.previous')}
        >
          <Icon.Chevron_Left />
        </button>
        <button
          type="button"
          className="Icon_Button"
          onClick={() => move(1)}
          disabled={edges.end}
          aria-label={t('portfolio.next')}
          title={t('portfolio.next')}
        >
          <Icon.Chevron_Right />
        </button>
      </div>
      <div className="Portfolio_Carousel_Track" ref={track} onScroll={measure}>
        {children}
      </div>
    </div>
  );
};

export default Portfolio_Carousel;

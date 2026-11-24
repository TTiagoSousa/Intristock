import type { ReactNode } from 'react';
import { useFitHeight } from './useFitHeight';

/** O `Table_Wrap` das linhas: até ao fundo do ecrã, com o scroll dele e o cabeçalho preso em cima. */
const Fit_Table_Wrap = ({ children }: { children: ReactNode }) => {
  const ref = useFitHeight<HTMLDivElement>();
  return (
    <div ref={ref} className="Table_Wrap Call_Center_Scroll">
      {children}
    </div>
  );
};

export default Fit_Table_Wrap;

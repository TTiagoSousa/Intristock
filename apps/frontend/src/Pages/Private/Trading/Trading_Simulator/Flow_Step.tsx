import type { ReactNode } from 'react';

interface Flow_Step_Props {
  number: number;
  title: string;
  hint?: string;
  children: ReactNode;
}

/**
 * Um passo de uma entrada (entra quando → entra a → sai): o número numa
 * bolinha, ligado ao passo seguinte por uma linha, o título e o conteúdo.
 */
const Flow_Step = ({ number, title, hint, children }: Flow_Step_Props) => (
  <section className="Flow_Step">
    <div className="Flow_Step_Rail" aria-hidden="true">
      <span className="Flow_Step_Number">{number}</span>
    </div>

    <div className="Flow_Step_Body">
      <div className="Flow_Step_Header">
        <span className="Flow_Step_Title">{title}</span>
        {hint && <span className="Flow_Step_Hint">{hint}</span>}
      </div>
      {children}
    </div>
  </section>
);

export default Flow_Step;

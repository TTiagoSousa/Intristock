import Factsheet_Explain from './Factsheet_Explain';

interface Factsheet_Heading_Props {
  title: string;
  // A que parte da simulação se refere (ex.: "Estratégia · Regras")
  tag?: string;
  info?: string;
  // A explicação do "?" (para as secções cujo conteúdo não tem painel próprio)
  explain?: string;
}

// O título de uma secção: o nome, a parte da simulação e o que mostra
const Factsheet_Heading = ({ title, tag, info, explain }: Factsheet_Heading_Props) => (
  <div className="Factsheet_Heading">
    <h3 className="Factsheet_Title">
      {title}
      {explain && <Factsheet_Explain id={explain} title={title} />}
      {tag && <span className="Factsheet_Tag">{tag}</span>}
    </h3>
    {info && <p className="Factsheet_Info">{info}</p>}
  </div>
);

export default Factsheet_Heading;

import Factsheet_Explain from './Factsheet_Explain';
import Factsheet_Help from './Factsheet_Help';

export type Tone = 'Positive' | 'Negative' | '';

interface Factsheet_Card_Props {
  label: string;
  help: string;
  // A explicação longa do "?" (trading.fsExplain_<explain>_*); sem ela, só a ajuda ao passar o rato
  explain?: string;
  value: string;
  detail: string;
  tone?: Tone;
}

// Um cartão de um número: o nome (com a ajuda), o valor e uma linha por baixo
const Factsheet_Card = ({ label, help, explain, value, detail, tone = '' }: Factsheet_Card_Props) => (
  <div className={`Factsheet_Card ${tone}`}>
    <span className="Factsheet_Label">
      {label}
      {explain ? <Factsheet_Explain id={explain} title={label} summary={help} /> : <Factsheet_Help text={help} />}
    </span>
    <strong className="Factsheet_Value">{value}</strong>
    <span className="Factsheet_Detail">{detail}</span>
  </div>
);

export default Factsheet_Card;

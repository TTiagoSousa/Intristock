interface Factsheet_Help_Props {
  // O que se explica (lido pelos leitores de ecrã e mostrado ao passar o rato)
  text: string;
}

// Um "?" ao lado de um título: a explicação aparece por cima ao passar o rato
// ou ao chegar lá com o teclado
const Factsheet_Help = ({ text }: Factsheet_Help_Props) => (
  <span className="Factsheet_Help" tabIndex={0} aria-label={text}>
    ?
    <span className="Factsheet_Help_Tip" role="tooltip">
      {text}
    </span>
  </span>
);

export default Factsheet_Help;

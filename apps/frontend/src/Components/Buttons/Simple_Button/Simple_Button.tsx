import './Simple_Button.scss';

// As variantes vivem no Simple_Button.scss. Ficam aqui expostas para as
// páginas não terem de inventar um botão próprio só para ter um secundário.
type Simple_Button_Variant = 'Primary' | 'Ghost' | 'Quiet' | 'Danger';

interface Simple_Button_Props {
  text?: string;
  onClick?: () => void;
  type?: 'button' | 'submit' | 'reset';
  disabled?: boolean;
  variant?: Simple_Button_Variant;
  // Botão pequeno, para ações dentro de cartões e linhas de tabela
  small?: boolean;
  // Largura pelo conteúdo em vez de encher o espaço do pai
  auto?: boolean;
}

const Simple_Button = ({
  text = '',
  onClick,
  type = 'button',
  disabled = false,
  variant = 'Primary',
  small = false,
  auto = false,
}: Simple_Button_Props) => {
  const classes = ['Simple_Button', variant, small ? 'Small' : '', auto ? 'Auto' : '']
    .filter(Boolean)
    .join(' ');

  return (
    <button type={type} onClick={onClick} disabled={disabled} className={classes}>
      <span>{text}</span>
    </button>
  );
};

export default Simple_Button;

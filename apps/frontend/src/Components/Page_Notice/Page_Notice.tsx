import { useNavigate } from 'react-router';
import Simple_Button from '../Buttons/Simple_Button/Simple_Button';
import './Page_Notice.scss';

interface Page_Notice_Props {
  title: string;
  text: string;
  // O botão leva a um sítio que se pode abrir (o início, a visão geral da empresa)
  actionText?: string;
  actionPath?: string;
}

// Um aviso no lugar da página: a página não existe ou a pessoa não a pode ver.
// Sossegado, como o estado vazio das listas, sem erros do backend.
const Page_Notice = ({ title, text, actionText, actionPath }: Page_Notice_Props) => {
  const navigate = useNavigate();

  return (
    <div className="Page_Notice">
      <div className="Empty_State">
        <span className="Empty_State_Title">{title}</span>
        <span className="Empty_State_Text">{text}</span>
        {actionText && actionPath && (
          <div className="Page_Notice_Action">
            <Simple_Button text={actionText} variant="Ghost" small auto onClick={() => navigate(actionPath)} />
          </div>
        )}
      </div>
    </div>
  );
};

export default Page_Notice;

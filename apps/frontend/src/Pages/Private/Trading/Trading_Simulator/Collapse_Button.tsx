import { useTranslation } from 'react-i18next';
import { Chevron_Down } from '../../../../Imports/icons';

interface Collapse_Button_Props {
  open: boolean;
  onToggle: () => void;
  // O id do conteúdo que abre e fecha, para o leitor de ecrã
  controls: string;
}

/** A seta para abrir e fechar um cartão: para baixo aberto, para o lado fechado. */
const Collapse_Button = ({ open, onToggle, controls }: Collapse_Button_Props) => {
  const { t } = useTranslation();
  const label = open ? t('trading.collapse') : t('trading.expand');

  return (
    <button
      type="button"
      className={`Collapse_Button${open ? ' Open' : ''}`}
      onClick={onToggle}
      aria-expanded={open}
      aria-controls={controls}
      title={label}
      aria-label={label}
    >
      <Chevron_Down />
    </button>
  );
};

export default Collapse_Button;

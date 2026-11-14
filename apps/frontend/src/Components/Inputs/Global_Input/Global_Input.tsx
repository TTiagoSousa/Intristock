import type { ComponentType } from 'react';
import './Global_Input.scss';

interface Global_Input_Props {
  id?: string;
  type?: string;
  value?: string;
  onChange?: (e: React.ChangeEvent<HTMLInputElement>) => void;
  onBlur?: () => void;
  placeholder?: string;
  // Ícone dentro do campo, à esquerda (ex. a lupa de uma pesquisa). Sem ele o
  // campo fica exatamente como estava.
  icon?: ComponentType<{ color?: string }>;
  // Campo bloqueado — o estilo do :disabled já existe no SCSS
  disabled?: boolean;
  maxLength?: number;
  // Para o browser e os gestores de passwords (ex. current-password, new-password)
  autoComplete?: string;
  // O id de uma <datalist> com sugestões (ex. os produtos já comprados)
  list?: string;
}

const Global_Input = ({
  id,
  type = 'text',
  value,
  onChange,
  onBlur,
  placeholder,
  icon: Field_Icon,
  disabled = false,
  maxLength,
  autoComplete,
  list,
}: Global_Input_Props) => {
  return (
    <div className={`Global_Input${Field_Icon ? ' With_Icon' : ''}`}>
      <input
        id={id}
        type={type}
        value={value}
        onChange={onChange}
        onBlur={onBlur}
        placeholder={placeholder}
        disabled={disabled}
        maxLength={maxLength}
        autoComplete={autoComplete}
        list={list}
      />

      {/* Vem depois do campo no HTML de propósito: é assim que o CSS lhe chega
          com `input:focus ~ .Input_Icon`. Na página aparece à esquerda, porque
          está posicionado de forma absoluta. */}
      {Field_Icon && (
        <span className="Input_Icon" aria-hidden="true">
          <Field_Icon />
        </span>
      )}
    </div>
  );
};

export default Global_Input;

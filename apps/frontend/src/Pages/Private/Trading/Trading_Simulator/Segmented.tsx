interface Segmented_Option<T extends string> {
  value: T;
  label: string;
  title?: string;
  disabled?: boolean;
}

interface Segmented_Props<T extends string> {
  value: T;
  options: Segmented_Option<T>[];
  onChange: (value: T) => void;
  label: string;
  id?: string;
}

/** Duas a quatro escolhas curtas lado a lado (isolada | cruzada), sem abrir uma lista. */
const Segmented = <T extends string>({ value, options, onChange, label, id }: Segmented_Props<T>) => (
  <div className="Segmented" role="group" aria-label={label} id={id}>
    {options.map((option) => (
      <button
        key={option.value}
        type="button"
        className={`Segmented_Option${option.value === value ? ' Active' : ''}`}
        aria-pressed={option.value === value}
        onClick={() => onChange(option.value)}
        disabled={option.disabled}
        title={option.title}
      >
        {option.label}
      </button>
    ))}
  </div>
);

export default Segmented;

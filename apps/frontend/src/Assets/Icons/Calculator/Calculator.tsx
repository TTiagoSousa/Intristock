interface CalculatorProps {
  color?: string;
}

const Calculator = ({ color = 'currentColor' }: CalculatorProps) => (
  <svg viewBox="0 0 24 24" fill="none" xmlns="http://www.w3.org/2000/svg" width="100%" height="100%">
    <rect x="4" y="2" width="16" height="20" rx="2" stroke={color} strokeWidth="1.75" />
    <rect x="7" y="5" width="10" height="4" rx="1" stroke={color} strokeWidth="1.75" />
    <circle cx="7.5" cy="13.5" r="1" fill={color} />
    <circle cx="12" cy="13.5" r="1" fill={color} />
    <circle cx="16.5" cy="13.5" r="1" fill={color} />
    <circle cx="7.5" cy="17.5" r="1" fill={color} />
    <circle cx="12" cy="17.5" r="1" fill={color} />
    <circle cx="16.5" cy="17.5" r="1" fill={color} />
  </svg>
);

export default Calculator;

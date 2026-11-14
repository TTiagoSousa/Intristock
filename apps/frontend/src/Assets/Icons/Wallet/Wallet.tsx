interface WalletProps {
  color?: string;
}

const Wallet = ({ color = 'currentColor' }: WalletProps) => (
  <svg viewBox="0 0 24 24" fill="none" xmlns="http://www.w3.org/2000/svg" width="100%" height="100%">
    <path d="M3 8C3 6.34315 4.34315 5 6 5H16C17.6569 5 19 6.34315 19 8V8.5H6.5C4.567 8.5 3 10.067 3 12V8Z" stroke={color} strokeWidth="1.75" />
    <path d="M3 12C3 10.067 4.567 8.5 6.5 8.5H18C19.1046 8.5 20 9.39543 20 10.5V17.5C20 18.6046 19.1046 19.5 18 19.5H6.5C4.567 19.5 3 17.933 3 16V12Z" stroke={color} strokeWidth="1.75" />
    <circle cx="16.5" cy="14" r="1.25" fill={color} />
  </svg>
);

export default Wallet;

interface Alert_Props {
  color?: string;
}

const Alert = ({ color = 'currentColor' }: Alert_Props) => (
  <svg viewBox="0 0 24 24" fill="none" xmlns="http://www.w3.org/2000/svg" width="100%" height="100%"
    stroke={color} strokeWidth="1.75" strokeLinecap="round" strokeLinejoin="round">
    <path d="M12 4.5 21 20H3z" />
    <path d="M12 10v4.2M12 17.2h.01" />
  </svg>
);

export default Alert;

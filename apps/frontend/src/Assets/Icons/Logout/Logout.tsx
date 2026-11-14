interface LogoutProps {
  color?: string;
}

const Logout = ({ color = 'currentColor' }: LogoutProps) => (
  <svg viewBox="0 0 24 24" fill="none" xmlns="http://www.w3.org/2000/svg" width="100%" height="100%">
    <path d="M9 4H6a2 2 0 0 0-2 2v12a2 2 0 0 0 2 2h3" stroke={color} strokeWidth="1.75" strokeLinecap="round" />
    <path d="M16 16l4-4-4-4" stroke={color} strokeWidth="1.75" strokeLinecap="round" strokeLinejoin="round" />
    <line x1="20" y1="12" x2="9" y2="12" stroke={color} strokeWidth="1.75" strokeLinecap="round" />
  </svg>
);

export default Logout;

interface Users_Props {
  color?: string;
}

const Users = ({ color = 'currentColor' }: Users_Props) => (
  <svg viewBox="0 0 24 24" fill="none" xmlns="http://www.w3.org/2000/svg" width="100%" height="100%"
    stroke={color} strokeWidth="1.75" strokeLinecap="round" strokeLinejoin="round">
    <circle cx="9.5" cy="8.5" r="3.4" />
    <path d="M3.2 19.6a6.6 6.6 0 0 1 12.6 0" />
    <path d="M16.2 5.6a3.4 3.4 0 0 1 0 6.5" />
    <path d="M18 14.6a6.6 6.6 0 0 1 3 4" />
  </svg>
);

export default Users;

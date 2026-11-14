interface EditProps {
  color?: string;
}

const Edit = ({ color = 'currentColor' }: EditProps) => (
  <svg viewBox="0 0 24 24" fill="none" xmlns="http://www.w3.org/2000/svg" width="100%" height="100%">
    <path d="M4 20H8L18.5 9.5C19.6 8.4 19.6 6.6 18.5 5.5C17.4 4.4 15.6 4.4 14.5 5.5L4 16V20Z" stroke={color} strokeWidth="1.75" strokeLinecap="round" strokeLinejoin="round" />
    <path d="M13.5 6.5L17.5 10.5" stroke={color} strokeWidth="1.75" strokeLinecap="round" />
  </svg>
);

export default Edit;

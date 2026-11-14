interface Bag_Props {
  color?: string;
}

const Bag = ({ color = 'currentColor' }: Bag_Props) => (
  <svg viewBox="0 0 24 24" fill="none" xmlns="http://www.w3.org/2000/svg" width="100%" height="100%"
    stroke={color} strokeWidth="1.75" strokeLinecap="round" strokeLinejoin="round">
    <path d="M4.5 7.5h15l-1 12a2 2 0 0 1-2 1.8H7.5a2 2 0 0 1-2-1.8z" />
    <path d="M8.8 10V6.4a3.2 3.2 0 0 1 6.4 0V10" />
  </svg>
);

export default Bag;

interface DashboardProps {
  color?: string;
}

const Dashboard = ({ color = 'currentColor' }: DashboardProps) => (
  <svg viewBox="0 0 24 24" fill="none" xmlns="http://www.w3.org/2000/svg" width="100%" height="100%">
    <rect x="3" y="3" width="8" height="8" rx="1.5" stroke={color} strokeWidth="1.75" />
    <rect x="13" y="3" width="8" height="8" rx="1.5" stroke={color} strokeWidth="1.75" />
    <rect x="3" y="13" width="8" height="8" rx="1.5" stroke={color} strokeWidth="1.75" />
    <rect x="13" y="13" width="8" height="8" rx="1.5" stroke={color} strokeWidth="1.75" />
  </svg>
);

export default Dashboard;

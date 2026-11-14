interface SettingsProps {
  color?: string;
}

const Settings = ({ color = 'currentColor' }: SettingsProps) => (
  <svg viewBox="0 0 24 24" fill="none" xmlns="http://www.w3.org/2000/svg" width="100%" height="100%">
    <line x1="4" y1="6" x2="20" y2="6" stroke={color} strokeWidth="1.75" strokeLinecap="round" />
    <circle cx="9" cy="6" r="2" fill={color} />
    <line x1="4" y1="12" x2="20" y2="12" stroke={color} strokeWidth="1.75" strokeLinecap="round" />
    <circle cx="15" cy="12" r="2" fill={color} />
    <line x1="4" y1="18" x2="20" y2="18" stroke={color} strokeWidth="1.75" strokeLinecap="round" />
    <circle cx="10" cy="18" r="2" fill={color} />
  </svg>
);

export default Settings;

interface UploadProps {
  color?: string;
}

const Upload = ({ color = 'currentColor' }: UploadProps) => (
  <svg viewBox="0 0 24 24" fill="none" xmlns="http://www.w3.org/2000/svg" width="100%" height="100%">
    <path d="M12 15V4" stroke={color} strokeWidth="1.75" strokeLinecap="round" />
    <path d="M8 8L12 4L16 8" stroke={color} strokeWidth="1.75" strokeLinecap="round" strokeLinejoin="round" />
    <path d="M5 18V19C5 19.5523 5.44772 20 6 20H18C18.5523 20 19 19.5523 19 19V18" stroke={color} strokeWidth="1.75" strokeLinecap="round" strokeLinejoin="round" />
  </svg>
);

export default Upload;

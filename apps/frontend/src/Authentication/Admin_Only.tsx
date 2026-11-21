import type { ReactNode } from 'react';
import { Navigate } from 'react-router';
import { useAuth } from '../Contexts/Auth_Context';

// As páginas de administração. Quem não for admin volta às definições — o
// backend recusaria tudo na mesma, mas assim não se vê uma página só de erros.
const Admin_Only = ({ children }: { children: ReactNode }) => {
  const { user } = useAuth();
  if (user?.role !== 'ADMIN') return <Navigate to="/Settings" replace />;
  return <>{children}</>;
};

export default Admin_Only;

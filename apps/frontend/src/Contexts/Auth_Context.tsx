// src/Contexts/Auth_Context.tsx

import { createContext, useContext, useEffect, useState, type ReactNode } from 'react';
import { End_Points } from '../Service/endPoints';
import http from '../Service/httpService';

export interface Auth_User {
  id: string;
  email: string;
  name?: string | null;
  fullName?: string | null;
  lastName?: string | null;
  // ADMIN gere a instalação (utilizadores, APIs, versões, catálogo)
  role?: 'ADMIN' | 'USER';
}

interface AuthContextType {
  authenticated: boolean;
  // O /user/me já era pedido aqui — antes a resposta era deitada fora e só
  // servia para dizer sim ou não. Agora fica, para o avatar e o menu de conta.
  user: Auth_User | null;
  setAuthenticated: React.Dispatch<React.SetStateAction<boolean>>;
  isLoading: boolean;
  refreshUser: () => Promise<void>;
  logout: () => Promise<void>;
}

const AuthContext = createContext<AuthContextType | undefined>(undefined);

interface AuthProviderProps {
  children: ReactNode;
}

export function AuthProvider({ children }: AuthProviderProps) {
  const [authenticated, setAuthenticated] = useState(false);
  const [user, setUser] = useState<Auth_User | null>(null);
  const [isLoading, setIsLoading] = useState(true);

  const refreshUser = async () => {
    setIsLoading(true);

    try {
      
      const response = await http.get(End_Points.User_Endpoint(), {
        withCredentials: true,
      });

      const user = response.data;

      if (user) {
        setUser(user);
        setAuthenticated(true);
      }
    } catch (error: any) {
      if (error.response?.status === 401) {
        // console.log('ℹ️ [AuthProvider] Utilizador não autenticado (401 Unauthorized).');
      } else {
        // console.error('❌ [AuthProvider] Erro na verificação de autenticação:', error);
      }

      setUser(null);
      setAuthenticated(false);
    } finally {
      setIsLoading(false);
    }
  };

  const logout = async () => {
    try {
      await http.post(End_Points.Logout_Endpoint());
    } finally {
      setUser(null);
      setAuthenticated(false);
    }
  };

  useEffect(() => {
    refreshUser();
  }, []);

  return (
    <AuthContext.Provider
      value={{
        authenticated,
        user,
        setAuthenticated,
        isLoading,
        refreshUser,
        logout,
      }}
    >
      {children}
    </AuthContext.Provider>
  );
}

export function useAuth() {
  const context = useContext(AuthContext);

  if (context === undefined) {
    throw new Error('useAuth must be used within an AuthProvider');
  }

  return context;
}
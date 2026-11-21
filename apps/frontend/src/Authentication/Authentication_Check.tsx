import { useEffect, type ReactNode } from 'react';
import { useNavigate } from 'react-router';
import * as Intermediate_Pages from '../Imports/intermediaryPages';
import { useAuth } from '../Contexts/Auth_Context';

interface AuthenticationCheckProps {
  children: ReactNode;
}

const AuthenticationCheck = ({ children }: AuthenticationCheckProps) => {
  const { authenticated, isLoading } = useAuth();
  const navigate = useNavigate();

  useEffect(() => {
    if (!isLoading && !authenticated) {
      // Ao login, com a página pedida para voltar a ela depois de entrar
      const here = window.location.pathname + window.location.search;
      navigate(`/Auth?next=${encodeURIComponent(here)}`, { replace: true });
    }
  }, [isLoading, authenticated, navigate]);

  if (isLoading) {
    return <Intermediate_Pages.Loading_Page />;
  }

  return authenticated ? <>{children}</> : null;
};

export default AuthenticationCheck;
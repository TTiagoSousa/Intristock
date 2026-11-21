import { lazy } from 'react';

// A página inicial tem o gráfico de exemplo (a biblioteca dos gráficos): carrega-se
// à parte, para o login não a descarregar
export const Index = lazy(() => import('../Pages/Public/Index/Index.tsx'));
export { default as Auth } from '../Pages/Public/Auth/Auth.tsx';

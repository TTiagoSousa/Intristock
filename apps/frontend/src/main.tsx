import { StrictMode } from 'react';
import { createRoot } from 'react-dom/client';
import { BrowserRouter } from 'react-router-dom';
import './i18n/i18n';
import App from './App.tsx';
import { ThemeProvider } from './Contexts/ThemeContext.tsx';
import { NavigationProvider } from './Contexts/Navs_Context.tsx';
import { AuthProvider } from './Contexts/Auth_Context.tsx';
import { AlertProvider } from './Contexts/Alert_Context.tsx';
import { CurrencyProvider } from './Contexts/Currency_Context.tsx';
import { BreadcrumbProvider } from './Contexts/Breadcrumb_Context.tsx';
import { ActiveRunProvider } from './Contexts/Active_Run_Context.tsx';

createRoot(document.getElementById('root')!).render(
  <StrictMode>
    <BrowserRouter>
      <ThemeProvider>
        <AlertProvider>
          <CurrencyProvider>
            <NavigationProvider>
              <BreadcrumbProvider>
                <ActiveRunProvider>
                  <AuthProvider>
                    <App />
                  </AuthProvider>
                </ActiveRunProvider>
              </BreadcrumbProvider>
            </NavigationProvider>
          </CurrencyProvider>
        </AlertProvider>
      </ThemeProvider>
    </BrowserRouter>
  </StrictMode>,
)

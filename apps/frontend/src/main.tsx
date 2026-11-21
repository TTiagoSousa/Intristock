import { StrictMode } from 'react';
import { createRoot } from 'react-dom/client';
import { BrowserRouter } from 'react-router';
import './i18n/i18n';
import I18n_Gate from './i18n/I18n_Gate';
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
        <I18n_Gate>
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
        </I18n_Gate>
      </ThemeProvider>
    </BrowserRouter>
  </StrictMode>,
)

import { Suspense } from 'react';
import { Route, Routes } from 'react-router';
import './App.scss';
import * as Public_Page from './Imports/publicPages.ts';
import Authentication_Check from './Authentication/Authentication_Check.tsx';
import * as Private_Page from './Imports/privatePages.ts';
import Simple_Alert from './Components/Alerts/Simple_Alert/Simple_Alert.tsx';
import * as Intermediate_Pages from './Imports/intermediaryPages';


function App() {
  return (
    <main>
      <Simple_Alert></Simple_Alert>
      <Routes>
        <Route
          index
          element={
            <Suspense fallback={<Intermediate_Pages.Loading_Page />}>
              <Public_Page.Index />
            </Suspense>
          }
        />
        <Route path="/Auth" element={<Public_Page.Auth />} />

        <Route
          path="/*"
          element={
            <Authentication_Check>
              {/* A área privada carrega-se à parte: o login e a página inicial não a descarregam */}
              <Suspense fallback={<Intermediate_Pages.Loading_Page />}>
                <Private_Page.Main />
              </Suspense>
            </Authentication_Check>
          }
        />
      </Routes>
    </main>
  );
}

export default App;

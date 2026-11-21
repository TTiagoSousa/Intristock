import { defineConfig } from 'vite'
import react from '@vitejs/plugin-react'

// https://vite.dev/config/
export default defineConfig({
  plugins: [react()],
  server: {
    host: true,
  },
  build: {
    rolldownOptions: {
      output: {
        // A biblioteca dos gráficos num ficheiro dela: as páginas que a usam
        // (simulador, portefólio, dashboards) partilham-na, e o login não a descarrega
        codeSplitting: {
          groups: [
            { name: 'openchartscandle', test: /node_modules[\\/]openchartscandle[\\/]/ },
          ],
        },
      },
    },
  },
})

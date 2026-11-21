import { defineConfig } from 'vite';
import react from '@vitejs/plugin-react';

export default defineConfig({
  plugins: [react()],
  // Relative asset paths so the built `dist` folder works with VS Code Live Server ("Go Live").
  base: './',
  server: { port: 5180, strictPort: true, open: false, host: true, proxy: { '/api': 'http://localhost:4100' } },
});

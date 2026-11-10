import { defineConfig } from 'vite';
import react from '@vitejs/plugin-react';

export default defineConfig({
  plugins: [react()],
  // Relative asset paths so the built `dist` folder works with VS Code Live Server ("Go Live").
  base: './',
  server: { port: 5173, open: false, host: true },
});

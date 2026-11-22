import { defineConfig } from 'vite';
import react from '@vitejs/plugin-react';

export default defineConfig(({ mode }) => ({
  plugins: [react()],
  // Relative asset paths so the built `dist` folder works with VS Code Live Server ("Go Live").
  // The root dev runner starts the admin with --mode admin so it works behind /admin/ on one preview URL.
  base: mode === 'admin' ? '/admin/' : './',
  server: { port: 5180, strictPort: true, open: false, host: true, proxy: { '/api': 'http://localhost:4100' } },
}));

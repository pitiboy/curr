import { defineConfig } from 'vite';
import react from '@vitejs/plugin-react';

export default defineConfig({
  plugins: [react()],
  base: '/backoffice/',
  server: {
    host: true,
    port: 8080,
  },
  preview: {
    host: true,
    port: 8080,
  },
});

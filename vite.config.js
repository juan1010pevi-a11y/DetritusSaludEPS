import { defineConfig } from 'vite';
import react from '@vitejs/plugin-react';

// Las llamadas a /api se reenvían al API Gateway: así el navegador nunca habla
// directo con el puerto 4000 y no hay problemas de CORS ni de puerto de Vite.
const apiTarget = process.env.API_PROXY_TARGET || 'http://localhost:4000';
const proxy = { '/api': { target: apiTarget, changeOrigin: true } };

export default defineConfig({
  plugins: [react()],
  server: { proxy },
  preview: { proxy },
});

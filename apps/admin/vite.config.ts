import tailwindcss from '@tailwindcss/vite';
import react from '@vitejs/plugin-react';
import { defineConfig } from 'vite';

// Development: the API runs on :4000; /v1 is proxied so the console and the API share an origin
// (the session cookie is SameSite=Strict). In production the API serves the built files itself.
export default defineConfig({
  plugins: [react(), tailwindcss()],
  server: { port: 5174, strictPort: true, proxy: { '/v1': 'http://localhost:4000' } },
  preview: { port: 5174, strictPort: true, proxy: { '/v1': 'http://localhost:4000' } },
});

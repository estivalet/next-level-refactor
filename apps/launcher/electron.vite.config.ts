import tailwindcss from '@tailwindcss/vite';
import react from '@vitejs/plugin-react';
import { defineConfig } from 'electron-vite';

// Workspace packages are TypeScript source, so they are bundled rather than required at runtime.
const bundleWorkspacePackages = { exclude: ['@nextlevel/shared'] };

export default defineConfig({
  main: {
    build: { externalizeDeps: bundleWorkspacePackages },
  },
  preload: {
    build: {
      externalizeDeps: bundleWorkspacePackages,
      // Sandboxed preloads cannot be ES modules; an ESM preload is silently skipped.
      rolldownOptions: { output: { format: 'cjs' } },
    },
  },
  renderer: {
    plugins: [react(), tailwindcss()],
  },
});

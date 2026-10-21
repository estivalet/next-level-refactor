import react from '@vitejs/plugin-react';
import { defineConfig } from 'vitest/config';

export default defineConfig({
  test: {
    passWithNoTests: true,
    projects: [
      {
        test: {
          name: 'launcher-main',
          environment: 'node',
          include: ['src/main/**/*.test.ts'],
        },
      },
      {
        plugins: [react()],
        test: {
          name: 'launcher-renderer',
          environment: 'jsdom',
          include: ['src/renderer/**/*.test.{ts,tsx}'],
          setupFiles: ['./src/renderer/test-setup.ts'],
        },
      },
    ],
  },
});

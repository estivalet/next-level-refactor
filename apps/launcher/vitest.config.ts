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
        test: {
          name: 'launcher-renderer',
          environment: 'jsdom',
          include: ['src/renderer/**/*.test.tsx'],
          setupFiles: ['./src/renderer/test-setup.ts'],
        },
      },
    ],
  },
});

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
          exclude: ['src/main/**/*.perf.test.ts'],
        },
      },
      {
        // 200k-game perf suites: one file at a time, after everything else, so their seeding
        // and timings never compete with each other or with the rest of the suite (CI has 2 cores).
        test: {
          name: 'launcher-perf',
          environment: 'node',
          include: ['src/main/**/*.perf.test.ts'],
          fileParallelism: false,
          sequence: { groupOrder: 1 },
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

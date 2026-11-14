import react from '@vitejs/plugin-react';
import { defineConfig } from 'vitest/config';

// CI runners have 2 cores: a busy one has taken over 5 s (vitest's default) for a test that runs
// in 70 ms here (Installer.test.ts, PR #87). A hang still fails, later; local runs keep 5 s.
const testTimeout = process.env.GITHUB_ACTIONS === 'true' ? 20_000 : 5_000;

export default defineConfig({
  test: {
    passWithNoTests: true,
    projects: [
      {
        test: {
          name: 'launcher-main',
          environment: 'node',
          testTimeout,
          include: ['src/main/**/*.test.ts', 'scripts/**/*.test.ts'],
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
          testTimeout,
          include: ['src/renderer/**/*.test.{ts,tsx}'],
          setupFiles: ['./src/renderer/test-setup.ts'],
        },
      },
    ],
  },
});

import { defineConfig } from 'vitest/config';

// CI runners have 2 cores: a busy one has taken over 5 s (vitest's default) for tests that run
// in well under a second here (PR #87, main after #89). A hang still fails, later; local runs
// keep 5 s.
const testTimeout = process.env.GITHUB_ACTIONS === 'true' ? 20_000 : 5_000;

export default defineConfig({
  test: {
    testTimeout,
    name: 'api',
    environment: 'node',
    include: ['src/**/*.test.ts'],
  },
});

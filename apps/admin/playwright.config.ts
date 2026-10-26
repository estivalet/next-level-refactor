import { defineConfig, devices } from '@playwright/test';
import { tmpdir } from 'node:os';
import { join } from 'node:path';

const PORT = 4610;
const BASE = `http://127.0.0.1:${String(PORT)}`;

// The real API serves the built console (ADMIN_DIST) on one origin, with the sign-in stub and a
// fresh temp database per run. `npm run test:e2e -w apps/admin` builds the console first.
export default defineConfig({
  testDir: './e2e',
  timeout: 30_000,
  workers: 1,
  forbidOnly: Boolean(process.env['CI']),
  reporter: process.env['CI'] ? 'github' : 'list',
  use: { baseURL: BASE, ...devices['Desktop Chrome'] },
  webServer: {
    command: 'node ../api/src/server.ts',
    url: `${BASE}/v1/health`,
    reuseExistingServer: false,
    env: {
      NODE_ENV: 'test',
      PORT: String(PORT),
      PUBLIC_URL: BASE,
      DATABASE_URL: `file:${join(tmpdir(), `nextlevel-admin-e2e-${String(Date.now())}`, 'api.db')}`,
      JWT_SECRET: Buffer.alloc(32, 5).toString('base64'),
      ADMIN_EMAILS: 'admin@nextlevel.test',
      BILLING_ENABLED: 'false',
      AUTH_STUB: '1',
      ADMIN_DIST: join(import.meta.dirname, 'dist'),
    },
  },
});

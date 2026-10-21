import { defineConfig } from '@playwright/test';

export default defineConfig({
  testDir: './e2e',
  timeout: 30_000,
  // Each test drives a real Electron window; parallel windows steal OS focus (and pointer capture)
  // from each other, so tests run one at a time.
  workers: 1,
  forbidOnly: Boolean(process.env['CI']),
  reporter: process.env['CI'] ? 'github' : 'list',
});

import { _electron as electron, expect, test } from '@playwright/test';

test('NFR-MAINT-1: launcher boots and shows Hello with the version via the bridge', async () => {
  // VS Code terminals set ELECTRON_RUN_AS_NODE, which would start Electron as plain Node.
  const env = Object.fromEntries(
    Object.entries(process.env).filter(
      (entry): entry is [string, string] =>
        entry[0] !== 'ELECTRON_RUN_AS_NODE' && entry[1] !== undefined,
    ),
  );
  const app = await electron.launch({ args: ['.'], env });
  try {
    const page = await app.firstWindow();
    await expect(page.getByRole('heading', { name: 'Hello' })).toBeVisible();
    await expect(page.getByText('Version 0.0.0')).toBeVisible();
    expect(await page.evaluate(() => typeof window.nextlevel)).toBe('object');
  } finally {
    await app.close();
  }
});

import { _electron as electron, expect, test } from '@playwright/test';
import { readFileSync } from 'node:fs';
import { join } from 'node:path';

const appDir = join(import.meta.dirname, '..');
const { version } = JSON.parse(readFileSync(join(appDir, 'package.json'), 'utf8')) as {
  version: string;
};

test('FR-SHELL-1/2/5: open Settings from the desktop, see the version, drag the window, quit from Start', async () => {
  // VS Code terminals set ELECTRON_RUN_AS_NODE, which would start Electron as plain Node.
  const env = Object.fromEntries(
    Object.entries(process.env).filter(
      (entry): entry is [string, string] =>
        entry[0] !== 'ELECTRON_RUN_AS_NODE' && entry[1] !== undefined,
    ),
  );
  const app = await electron.launch({ args: [appDir], env });
  const page = await app.firstWindow();

  await page
    .getByRole('navigation', { name: 'Desktop apps' })
    .getByRole('button', { name: 'Settings' })
    .dblclick();
  const settings = page.getByRole('dialog', { name: 'Settings' });
  await expect(settings).toBeVisible();
  await expect(settings.getByText(`Version ${version}`)).toBeVisible();

  // Measure after the open animation (scale 0.96 → 1) has finished.
  await expect.poll(async () => (await settings.boundingBox())?.width).toBe(900);
  const before = await settings.boundingBox();
  if (!before) throw new Error('Settings window has no box');
  const grip = { x: before.x + before.width / 2, y: before.y + 18 };
  await page.mouse.move(grip.x, grip.y);
  await page.mouse.down();
  await page.mouse.move(grip.x + 60, grip.y + 40, { steps: 5 });
  await page.mouse.move(grip.x + 120, grip.y + 80, { steps: 5 });
  await page.mouse.up();
  await expect
    .poll(async () => {
      const box = await settings.boundingBox();
      return box ? [Math.round(box.x - before.x), Math.round(box.y - before.y)] : null;
    })
    .toEqual([120, 80]);

  const closed = app.waitForEvent('close');
  await page.getByRole('button', { name: 'Start' }).click();
  await page.getByRole('button', { name: 'Quit' }).click();
  await closed;
});

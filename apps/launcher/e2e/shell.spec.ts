import { expect, test } from '@playwright/test';
import { appVersion, freshDataDir, launch, taskbar } from './launch.ts';

test('FR-SHELL-1/2/5: open Settings from the desktop, see the version, drag the window, quit from Start', async () => {
  const data = await freshDataDir();
  const app = await launch(data.dir);
  const page = await app.firstWindow();

  await page
    .getByRole('navigation', { name: 'Desktop apps' })
    .getByRole('button', { name: 'Settings' })
    .dblclick();
  const settings = page.getByRole('dialog', { name: 'Settings' });
  await expect(settings).toBeVisible();
  await settings.getByRole('button', { name: 'About' }).click();
  await expect(settings.getByText(`Version ${await appVersion()}`)).toBeVisible();

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
  await (await taskbar(page)).getByRole('button', { name: 'Start' }).click();
  await page.getByRole('button', { name: 'Quit' }).click();
  await closed;
  await data.remove();
});

test('FR-SHELL-6: the launcher window opens maximized', async () => {
  const data = await freshDataDir();
  try {
    const app = await launch(data.dir);
    await app.firstWindow();
    const maximized = await app.evaluate(({ BrowserWindow }) =>
      BrowserWindow.getAllWindows()[0]?.isMaximized(),
    );
    expect(maximized).toBe(true);
    await app.close();
  } finally {
    await data.remove();
  }
});

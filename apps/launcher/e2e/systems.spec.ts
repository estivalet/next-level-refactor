import { expect, test, type Page } from '@playwright/test';
import { freshDataDir, launch } from './launch.ts';

async function openSettingsSection(page: Page, section: string) {
  await page
    .getByRole('navigation', { name: 'Desktop apps' })
    .getByRole('button', { name: 'Settings' })
    .dblclick();
  const settings = page.getByRole('dialog', { name: 'Settings' });
  await settings.getByRole('button', { name: section }).click();
  return settings;
}

test('FR-EMU-1/FR-LIB-1/FR-LIB-2: enable a system, override its folder, add storage; all persist', async () => {
  const data = await freshDataDir();
  const roms = await freshDataDir();
  try {
    let app = await launch(data.dir, { NEXTLEVEL_E2E_PICK_FOLDER: roms.dir });
    let page = await app.firstWindow();

    // Systems: enable Nintendo 64 and rename its ROM folder.
    let settings = await openSettingsSection(page, 'Systems');
    await settings.getByRole('searchbox', { name: 'Search systems' }).fill('nintendo 64');
    await settings.getByRole('switch', { name: 'Enable Nintendo 64', exact: true }).click();
    await settings.getByRole('button', { name: 'Edit Nintendo 64', exact: true }).click();
    await settings.getByRole('textbox', { name: 'ROM folder name' }).fill('N64');
    await settings.getByRole('button', { name: 'Save' }).click();
    await expect(settings.getByRole('button', { name: 'Save' })).toBeHidden();

    // Storage: add the (stubbed) picked folder.
    await settings.getByRole('button', { name: 'Storage' }).click();
    await settings.getByRole('button', { name: 'Add location…' }).click();
    await expect(settings.getByText(roms.dir)).toBeVisible();
    await settings.getByRole('button', { name: 'Save' }).click();
    await expect(settings.getByRole('button', { name: 'Save' })).toBeHidden();
    // DIAGNOSTIC (temporary): what was on disk before and after closing.
    const fsp = await import('node:fs/promises');
    const nodePath = await import('node:path');
    const joinPath = (...parts: string[]) => nodePath.join(...parts);
    const read = (path: string, encoding: 'utf8') => fsp.readFile(path, encoding);
    const list = (path: string) => fsp.readdir(path);
    const before = await read(joinPath(data.dir, 'settings.json'), 'utf8').catch((e: unknown) =>
      String(e),
    );
    await app.close();
    const after = await read(joinPath(data.dir, 'settings.json'), 'utf8').catch((e: unknown) =>
      String(e),
    );
    const backups = await list(joinPath(data.dir, 'backups')).catch(() => []);
    const logs = await list(joinPath(data.dir, 'logs')).catch(() => []);
    const logText = logs.length
      ? await read(joinPath(data.dir, 'logs', logs[0] ?? ''), 'utf8').catch(() => '')
      : '';
    await test.info().attach('diagnostic.txt', {
      body: `BEFORE CLOSE\n${before}\n\nAFTER CLOSE\n${after}\n\nBACKUPS ${backups.join(', ')}\n\nLOG\n${logText}`,
      contentType: 'text/plain',
    });

    // Restart: everything was read back from settings.json.
    app = await launch(data.dir);
    page = await app.firstWindow();
    settings = await openSettingsSection(page, 'Systems');
    await settings.getByRole('searchbox', { name: 'Search systems' }).fill('nintendo 64');
    await expect(
      settings.getByRole('switch', { name: 'Enable Nintendo 64', exact: true }),
    ).toHaveAttribute('aria-checked', 'true');
    await expect(settings.getByText('Nintendo · Folder: N64')).toBeVisible();
    await settings.getByRole('button', { name: 'Storage' }).click();
    await expect(settings.getByText(roms.dir)).toBeVisible();
    await app.close();
  } finally {
    await data.remove();
    await roms.remove();
  }
});

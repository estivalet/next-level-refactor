import { expect, test } from '@playwright/test';
import { mkdir, writeFile } from 'node:fs/promises';
import { join } from 'node:path';
import { freshDataDir, launch } from './launch.ts';

test('FR-THM-2, FR-THM-6: a scan indexes game art and nextlevel:// serves it to the renderer', async () => {
  const data = await freshDataDir();
  const roms = await freshDataDir();
  try {
    // Made-up placeholder files; the "image" is plain bytes.
    await mkdir(join(roms.dir, 'Nintendo 64', 'media', 'box-front'), { recursive: true });
    await writeFile(join(roms.dir, 'Nintendo 64', 'Homebrew Demo.z64'), '');
    await writeFile(
      join(roms.dir, 'Nintendo 64', 'media', 'box-front', 'Homebrew Demo.png'),
      'BOXART',
    );

    const app = await launch(data.dir, { NEXTLEVEL_E2E_PICK_FOLDER: roms.dir });
    const page = await app.firstWindow();
    await page
      .getByRole('navigation', { name: 'Desktop apps' })
      .getByRole('button', { name: 'Settings' })
      .dblclick();
    const settings = page.getByRole('dialog', { name: 'Settings' });
    await settings.getByRole('button', { name: 'Storage' }).click();
    await settings.getByRole('button', { name: 'Add location…' }).click();
    await settings.getByRole('button', { name: 'Save' }).click();
    await expect(settings.getByRole('region', { name: 'You have unsaved changes.' })).toBeHidden();
    await settings.getByRole('button', { name: 'Scan now' }).click();
    await expect(settings.getByText(/1 game in 1 system/)).toBeVisible();

    const served = await page.evaluate(async () => {
      const bridge = window.nextlevel;
      if (!bridge) throw new Error('no bridge');
      const games = await bridge.invoke('frontend.games', { nodeId: 's:nintendo-64' });
      if (!games.ok) throw new Error(games.error.message);
      const game = games.value[0];
      if (!game) throw new Error('no game');
      const url = `nextlevel://media/${String(game.id)}/box-front`;
      const whole = await fetch(url);
      const part = await fetch(url, { headers: { Range: 'bytes=0-2' } });
      const outside = await fetch('nextlevel://art/assets/..%2F..%2Fsettings.json');
      return {
        media: game.media,
        whole: [whole.status, await whole.text()],
        part: [part.status, await part.text()],
        outside: outside.status,
      };
    });
    expect(served).toEqual({
      media: ['box-front'],
      whole: [200, 'BOXART'],
      part: [206, 'BOX'],
      outside: 404,
    });
    await app.close();
  } finally {
    await data.remove();
    await roms.remove();
  }
});

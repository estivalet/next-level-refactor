import { expect, test, type ElectronApplication, type Page } from '@playwright/test';
import { freshDataDir, launch } from './launch.ts';

async function openSettings(page: Page, title: string) {
  await page
    .getByRole('navigation', { name: /Desktop apps|Aplicativos da área de trabalho/ })
    .getByRole('button', { name: title })
    .dblclick();
  const settings = page.getByRole('dialog', { name: title });
  await expect(settings).toBeVisible();
  return settings;
}

async function close(app: ElectronApplication) {
  const closed = app.waitForEvent('close');
  await app.close();
  await closed.catch(() => undefined);
}

test('FR-SET-1/3, US-D3: a setting persists across restart, and a backup restores it', async () => {
  const data = await freshDataDir();
  try {
    // 1. Switch the language to Portuguese and save.
    let app = await launch(data.dir);
    let page = await app.firstWindow();
    let settings = await openSettings(page, 'Settings');
    await settings.getByRole('combobox', { name: 'Language' }).selectOption('pt-BR');
    await settings.getByRole('button', { name: 'Save' }).click();
    await expect(page.getByRole('dialog', { name: 'Configurações' })).toBeVisible();
    await close(app);

    // 2. Restart: still Portuguese, read back from settings.json.
    app = await launch(data.dir);
    page = await app.firstWindow();
    settings = await openSettings(page, 'Configurações');
    await expect(settings.getByRole('combobox', { name: 'Idioma' })).toHaveValue('pt-BR');

    // 3. The first save left no backup (there was no file yet); save again to make one.
    await settings.getByRole('switch', { name: 'Iniciar com o Windows' }).click();
    await settings.getByRole('button', { name: 'Salvar' }).click();
    await expect(settings.getByRole('button', { name: 'Salvar' })).toBeHidden();

    // 4. Restore the backup from before that save: still Portuguese, switch off.
    await settings.getByRole('button', { name: 'Backups' }).click();
    await settings.getByRole('button', { name: 'Restaurar' }).first().click();
    await settings.getByRole('button', { name: 'Confirmar restauração' }).click();
    await expect(settings.getByText('Backup restaurado.')).toBeVisible();
    await settings.getByRole('button', { name: 'Geral' }).click();
    await expect(settings.getByRole('switch', { name: 'Iniciar com o Windows' })).not.toBeChecked();
    await expect(settings.getByRole('combobox', { name: 'Idioma' })).toHaveValue('pt-BR');
    await close(app);
  } finally {
    await data.remove();
  }
});

test('FR-SET-8: the UI scale zooms the window on save and again after a restart', async () => {
  const data = await freshDataDir();
  const zoom = (app: ElectronApplication) =>
    app.evaluate(({ BrowserWindow }) =>
      BrowserWindow.getAllWindows()[0]?.webContents.getZoomFactor(),
    );
  try {
    let app = await launch(data.dir);
    let page = await app.firstWindow();
    const settings = await openSettings(page, 'Settings');
    await settings.getByRole('combobox', { name: 'UI scale' }).selectOption('125');
    await settings.getByRole('button', { name: 'Save' }).click();
    await expect.poll(() => zoom(app)).toBe(1.25);
    await close(app);

    app = await launch(data.dir);
    page = await app.firstWindow();
    await page.waitForLoadState('load');
    await expect.poll(() => zoom(app)).toBe(1.25);
    await close(app);
  } finally {
    await data.remove();
  }
});

test('NFR-A11Y-1: the settings switch knob sits inside its track in both states', async () => {
  const data = await freshDataDir();
  try {
    const app = await launch(data.dir);
    const page = await app.firstWindow();
    const settings = await openSettings(page, 'Settings');
    const track = settings.getByRole('switch', { name: 'Start with Windows' });
    const knob = track.locator('span');

    for (const state of ['off', 'on'] as const) {
      if (state === 'on') await track.click();
      // Let the slide transition finish before measuring.
      await expect(track).toHaveAttribute('aria-checked', state === 'on' ? 'true' : 'false');
      await page.waitForTimeout(300);
      const t = await track.boundingBox();
      const k = await knob.boundingBox();
      if (!t || !k) throw new Error('no box');
      const gapLeft = k.x - t.x;
      const gapRight = t.x + t.width - (k.x + k.width);
      expect(Math.min(gapLeft, gapRight), `${state}: knob inside track`).toBeGreaterThanOrEqual(0);
      // Flush against the correct end (2px padding), never floating in the middle.
      expect(Math.round(state === 'on' ? gapRight : gapLeft), `${state}: knob at its end`).toBe(2);
    }
    await app.close();
  } finally {
    await data.remove();
  }
});

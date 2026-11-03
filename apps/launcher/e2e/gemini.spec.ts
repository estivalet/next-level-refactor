import { expect, test } from '@playwright/test';
import { createServer } from 'node:http';
import type { AddressInfo } from 'node:net';
import { mkdir, writeFile } from 'node:fs/promises';
import { join } from 'node:path';
import { freshDataDir, launch, openScope } from './launch.ts';

/** A fake Gemini API: one grounded reply that knows the year and not the developer. */
async function startFakeGemini() {
  const keys: string[] = [];
  const server = createServer((request, response) => {
    keys.push(String(request.headers['x-goog-api-key'] ?? ''));
    let body = '';
    request.on('data', (chunk: Buffer) => {
      body += chunk.toString('utf8');
    });
    request.on('end', () => {
      const gameId = /\\?"gameId\\?": (\d+)/.exec(body)?.[1] ?? '0';
      const answer = [
        {
          gameId: Number(gameId),
          title: { known: false, value: null },
          year: { known: true, value: 1991 },
          developer: { known: false, value: null },
        },
      ];
      response.writeHead(200, { 'content-type': 'application/json' });
      response.end(
        JSON.stringify({
          candidates: [
            {
              content: { parts: [{ text: `\`\`\`json\n${JSON.stringify(answer)}\n\`\`\`` }] },
              groundingMetadata: {
                groundingChunks: [{ web: { uri: 'https://example.org/demo', title: 'Demo page' } }],
              },
            },
          ],
        }),
      );
    });
  });
  await new Promise<void>((resolve) => server.listen(0, '127.0.0.1', resolve));
  const url = `http://127.0.0.1:${String((server.address() as AddressInfo).port)}/v1beta`;
  return {
    url,
    keys,
    close: () =>
      new Promise<void>((resolve) => {
        server.close(() => {
          resolve();
        });
      }),
  };
}

test('FR-SCR-7: Fill details with Gemini writes what Gemini knows and leaves the rest', async () => {
  test.setTimeout(120_000);
  const data = await freshDataDir();
  const roms = await freshDataDir();
  const server = await startFakeGemini();
  try {
    await mkdir(join(roms.dir, 'Nintendo 64'));
    await writeFile(join(roms.dir, 'Nintendo 64', 'Homebrew Demo.z64'), 'DEMO');

    const app = await launch(data.dir, {
      NEXTLEVEL_E2E_PICK_FOLDER: roms.dir,
      NEXTLEVEL_GEMINI_URL: server.url,
    });
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
    await settings.getByRole('button', { name: 'Scraper' }).click();
    await settings.getByLabel('API key').fill('AIza-e2e-test-key');
    await settings.getByRole('button', { name: 'Save key' }).click();
    await expect(settings.getByPlaceholder('Saved')).toBeVisible();
    await settings.getByRole('button', { name: 'Close' }).click();

    await page
      .getByRole('navigation', { name: 'Desktop apps' })
      .getByRole('button', { name: 'Game Library' })
      .dblclick();
    const library = page.getByRole('dialog', { name: 'Game Library' });
    await library.getByRole('button', { name: 'Scan for games' }).click();
    await openScope(library, ['Nintendo', 'Nintendo 64']);
    const games = library.getByRole('listbox', { name: 'Games' });
    await games.getByRole('option', { name: /Homebrew Demo/ }).click({ button: 'right' });
    await page.getByRole('menuitem', { name: 'Fill details with Gemini…' }).click();

    const dialog = library.getByRole('dialog', { name: 'Fill details with Gemini: Homebrew Demo' });
    await expect(dialog.getByRole('checkbox', { name: 'Year' })).toBeChecked();
    await expect(dialog.getByRole('checkbox', { name: 'Developer' })).toBeDisabled();
    await expect(dialog.getByText("Gemini doesn't know").first()).toBeVisible();
    await expect(dialog.getByRole('link', { name: 'Demo page' })).toBeVisible();
    await dialog.getByRole('button', { name: 'Apply' }).click();
    await expect(dialog).toBeHidden();

    const details = library.getByRole('complementary', { name: 'Game details' });
    await expect(details.getByText(/^Scraped .+ from Gemini$/)).toBeVisible();
    await expect(details.getByText('1991')).toBeVisible();
    // The key went to the API in its header, and never to the renderer.
    expect(server.keys).toContain('AIza-e2e-test-key');
    await app.close();
  } finally {
    await server.close();
    await data.remove();
    await roms.remove();
  }
});

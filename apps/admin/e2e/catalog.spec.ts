import { expect, test, type Page } from '@playwright/test';

async function signIn(page: Page) {
  await page.goto('/');
  await page.getByRole('link', { name: 'Sign in with Google' }).click();
  await page.getByRole('link', { name: 'admin@nextlevel.test' }).click();
}

// Dummy bytes with a made-up homebrew name: no ROM data of any kind (test-strategy §2).
const DUMMY_ROM = {
  name: 'Star Hopper.nes',
  mimeType: 'application/octet-stream',
  buffer: Buffer.from(`NEXTLEVEL TEST FIXTURE Star Hopper.nes\n${'.'.repeat(4096)}`),
};

test('FR-ADM-3, US-F1, C10: an admin creates an item, uploads a ROM, verifies its license and publishes it', async ({
  page,
}) => {
  await signIn(page);

  await page.getByRole('link', { name: 'Catalog scopes' }).click();
  await page.getByLabel('Slug', { exact: true }).fill('homebrew-8bit');
  await page.getByLabel('Name', { exact: true }).fill('8-bit homebrew');
  await page.getByRole('button', { name: 'Add scope' }).click();
  // The saved scope gets its own row (with a Name field) above the New scope form.
  await expect(page.getByLabel('Name', { exact: true })).toHaveCount(2);

  await page.getByRole('link', { name: 'Catalog', exact: true }).click();
  await page.getByRole('link', { name: 'New item' }).click();
  await page.getByLabel('Slug', { exact: true }).fill('star-hopper');
  await page.getByLabel('Title', { exact: true }).fill('Star Hopper');
  await page.getByLabel('System', { exact: true }).selectOption('nintendo-nes');
  await page.getByRole('button', { name: 'Create' }).click();
  await expect(page.getByRole('heading', { name: 'Star Hopper' })).toBeVisible();

  await page.getByRole('link', { name: 'Publish', exact: true }).click();
  await expect(page.getByRole('button', { name: 'Publish' })).toBeDisabled();
  await expect(page.getByText('License required')).toBeVisible();

  await page.getByRole('link', { name: 'Files' }).click();
  await page.getByLabel('Upload a file').setInputFiles(DUMMY_ROM);
  await expect(page.getByRole('status')).toContainText('Star Hopper.nes uploaded');
  await expect(page.getByRole('table', { name: 'Files' })).toContainText('Star Hopper.nes');

  await page.getByRole('link', { name: 'License' }).click();
  await page.getByLabel('Rights holder').fill('Pixel Moth');
  await page.getByLabel('Contact', { exact: true }).fill('moth@example.test');
  await page
    .getByLabel('Terms', { exact: true })
    .fill('May be distributed to NextLevel subscribers.');
  await page.getByRole('button', { name: 'Save license' }).click();
  await expect(page.getByText('No evidence yet.')).toBeVisible();
  await page.getByLabel('Upload evidence').setInputFiles({
    name: 'permission.txt',
    mimeType: 'text/plain',
    buffer: Buffer.from('Yes, NextLevel may distribute Star Hopper. — Pixel Moth'),
  });
  await expect(page.getByRole('link', { name: 'permission.txt' })).toBeVisible();
  await page.getByRole('button', { name: 'Mark verified' }).click();
  await expect(page.getByText(/Verified by admin@nextlevel\.test/)).toBeVisible();

  await page.getByRole('link', { name: 'Publish', exact: true }).click();
  // The choice is saved at once; the radio shows it when the API answers.
  await page.getByRole('radio', { name: /Keep/ }).click();
  await expect(page.getByRole('radio', { name: /Keep/ })).toBeChecked();
  await page.getByRole('button', { name: 'Publish' }).click();
  await expect(page.getByText('Status: Published')).toBeVisible();

  await page.getByRole('link', { name: 'All items' }).click();
  const row = page
    .getByRole('table', { name: 'Catalog' })
    .getByRole('row', { name: /Star Hopper/ });
  await expect(row).toContainText('Verified');
  await expect(row).toContainText('Published');

  await page.getByRole('link', { name: 'Audit log' }).click();
  await expect(
    page.getByRole('table', { name: 'Audit log' }).getByText('Item published'),
  ).toBeVisible();
});

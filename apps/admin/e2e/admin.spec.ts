import { expect, test, type Page } from '@playwright/test';

async function signIn(page: Page, persona: 'admin' | 'subscriber') {
  await page.goto('/');
  await page.getByRole('link', { name: 'Sign in with Google' }).click();
  // The stub's consent page lists the personas.
  await page.getByRole('link', { name: `${persona}@nextlevel.test` }).click();
}

test('US-F3, FR-ADM-1/4/5: an admin suspends a subscriber, changes a setting, and both are audited', async ({
  page,
  browser,
}) => {
  await signIn(page, 'admin');
  // FR-ADM-6: the console opens on the dashboard.
  await expect(page.getByRole('heading', { name: 'Dashboard' })).toBeVisible();
  await expect(page.getByRole('group', { name: 'Active subscribers' })).toBeVisible();
  await page.getByRole('link', { name: 'Users' }).click();
  await expect(
    page.getByRole('table', { name: 'Users' }).getByText('admin@nextlevel.test'),
  ).toBeVisible();

  // A subscriber can't enter the console (their account exists after the attempt).
  const other = await browser.newContext();
  const subscriber = await other.newPage();
  await signIn(subscriber, 'subscriber');
  await expect(subscriber.getByRole('alert')).toHaveText("This account isn't an admin.");
  await other.close();

  await page.reload();
  await page.getByRole('link', { name: 'subscriber@nextlevel.test' }).click();
  await page.getByRole('button', { name: 'Suspend' }).click();
  const dialog = page.getByRole('dialog', { name: 'Suspend subscriber@nextlevel.test' });
  await dialog.getByLabel('Reason').fill('Account sharing');
  await dialog.getByRole('button', { name: 'Suspend' }).click();
  await expect(page.getByText('Suspended: Account sharing')).toBeVisible();

  await page.getByRole('link', { name: 'Settings' }).click();
  await page.getByLabel('Offline grace (days)').fill('7');
  await page.getByRole('button', { name: 'Save' }).click();
  await expect(page.getByRole('status')).toHaveText('Saved.');

  await page.getByRole('link', { name: 'Audit log' }).click();
  const audit = page.getByRole('table', { name: 'Audit log' });
  await expect(audit.getByText('Settings changed')).toBeVisible();
  const suspension = audit.getByRole('row').filter({ hasText: 'Suspended' });
  await expect(suspension).toContainText('admin@nextlevel.test');
  await expect(suspension).toContainText('Account sharing');

  await page.getByRole('button', { name: 'Sign out' }).click();
  await expect(page.getByRole('link', { name: 'Sign in with Google' })).toBeVisible();
});

test('FR-ADM-2, FR-SUB-4, US-F2: an admin makes a plan and grants it to a subscriber; audited', async ({
  page,
  browser,
}) => {
  // The subscriber's account exists once they have tried to sign in.
  const other = await browser.newContext();
  await signIn(await other.newPage(), 'subscriber');
  await other.close();
  await signIn(page, 'admin');

  await page.getByRole('link', { name: 'Plans' }).click();
  await page.getByRole('link', { name: 'New plan' }).click();
  await page.getByLabel('Slug').fill('friends');
  await page.getByLabel('Name').fill('Friends');
  await page.getByRole('button', { name: 'Save' }).click();
  await expect(page.getByRole('heading', { name: 'Friends' })).toBeVisible();

  await page.getByRole('link', { name: 'Users' }).click();
  await page.getByRole('link', { name: 'subscriber@nextlevel.test' }).click();
  await page.getByRole('button', { name: 'Grant complimentary access' }).click();
  const dialog = page.getByRole('dialog', { name: 'Grant complimentary access' });
  await dialog.getByLabel('Plan').selectOption('friends');
  await dialog.getByLabel('Note').fill('Beta tester');
  await dialog.getByRole('button', { name: 'Grant' }).click();
  const panel = page.getByRole('region', { name: 'Subscription' });
  await expect(panel.getByText(/Complimentary · Friends · Active · until revoked/)).toBeVisible();

  await page.getByRole('link', { name: 'Audit log' }).click();
  const audit = page.getByRole('table', { name: 'Audit log' });
  await expect(audit.getByText('Plan created')).toBeVisible();
  await expect(audit.getByText('Complimentary access granted')).toBeVisible();
});

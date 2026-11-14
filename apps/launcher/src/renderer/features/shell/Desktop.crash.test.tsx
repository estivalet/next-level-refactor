import { screen, within } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { setBridgeForTests } from '../../bridge.ts';
import { installFakeBridge, renderInShell } from '../../test-utils.tsx';
import { Desktop } from './Desktop.tsx';

let accountThrows = true;
vi.mock('../account/AccountApp.tsx', () => ({
  AccountApp: () => {
    if (accountThrows) throw new Error('account broke');
    return <p>account works</p>;
  },
}));

beforeEach(() => {
  vi.spyOn(console, 'error').mockImplementation(() => undefined);
  accountThrows = true;
});
afterEach(() => {
  vi.restoreAllMocks();
  setBridgeForTests(null);
});

describe('a desktop app that crashes (NFR-REL-2)', () => {
  it('NFR-REL-2: a desktop app that throws shows Reload window in its own window; the other window keeps working', async () => {
    const u = userEvent.setup();
    const bridge = installFakeBridge({ 'app.reportError': () => ({ ok: true, value: undefined }) });
    renderInShell(<Desktop />);
    await u.dblClick(screen.getByRole('button', { name: 'Account' }));
    await u.dblClick(screen.getByRole('button', { name: 'Settings' }));

    const account = screen.getByRole('dialog', { name: 'Account' });
    expect(within(account).getByText('This window ran into a problem.')).toBeVisible();
    expect(screen.getByRole('dialog', { name: 'Settings' })).toBeVisible();
    expect(bridge.calls.find((call) => call.channel === 'app.reportError')?.input).toMatchObject({
      where: 'window',
      id: 'account',
      message: 'account broke',
    });

    accountThrows = false;
    await u.click(within(account).getByRole('button', { name: 'Reload window' }));
    expect(within(account).getByText('account works')).toBeVisible();
  });
});

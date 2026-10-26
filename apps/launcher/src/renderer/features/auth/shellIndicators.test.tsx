import { ok } from '@nextlevel/shared';
import { screen, waitFor } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { afterEach, describe, expect, it } from 'vitest';
import { setBridgeForTests } from '../../bridge.ts';
import { installFakeBridge, renderInShell } from '../../test-utils.tsx';
import { BannerStrip } from './BannerStrip.tsx';
import { OfflineBadge } from './OfflineBadge.tsx';
import { signedIn } from './testing.ts';

afterEach(() => {
  setBridgeForTests(null);
});

describe('banner and offline indicator (D28, US-A3)', () => {
  it('D28: the banner shows in the shell until dismissed; a new text shows again', async () => {
    const user = userEvent.setup();
    const fake = installFakeBridge({ 'auth.state': () => ok(signedIn({ banner: 'Maintenance' })) });
    renderInShell(<BannerStrip />);
    expect(await screen.findByText('Maintenance')).toBeVisible();
    await user.click(screen.getByRole('button', { name: 'Dismiss' }));
    expect(screen.queryByText('Maintenance')).not.toBeInTheDocument();
    fake.emit('auth.changed', signedIn({ banner: 'Back at 23:00' }));
    expect(await screen.findByText('Back at 23:00')).toBeVisible();
  });

  it('US-A3: offline shows the indicator with the access deadline; online shows nothing', async () => {
    const fake = installFakeBridge({ 'auth.state': () => ok(signedIn({ offline: true })) });
    renderInShell(<OfflineBadge />);
    const badge = await screen.findByText('Offline');
    expect(badge.closest('[title]')?.getAttribute('title')).toMatch(/^Offline — access until /);
    fake.emit('auth.changed', signedIn());
    await waitFor(() => {
      expect(screen.queryByText('Offline')).not.toBeInTheDocument();
    });
  });
});

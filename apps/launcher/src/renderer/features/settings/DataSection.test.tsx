import { ok } from '@nextlevel/shared';
import { screen } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { afterEach, describe, expect, it } from 'vitest';
import { setBridgeForTests } from '../../bridge.ts';
import { installFakeBridge, renderInShell } from '../../test-utils.tsx';
import { DataSection } from './DataSection.tsx';

afterEach(() => {
  setBridgeForTests(null);
});

const PATHS = {
  data: 'C:/Users/me/AppData/Roaming/NextLevel',
  settings: 'C:/Users/me/AppData/Roaming/NextLevel/settings.json',
  backups: 'C:/Users/me/AppData/Roaming/NextLevel/backups',
  logs: 'C:/Users/me/AppData/Roaming/NextLevel/logs',
};

describe('DataSection', () => {
  it('FR-SET-7: shows where data lives, and Open folder opens it by key', async () => {
    const user = userEvent.setup();
    const bridge = installFakeBridge({
      'app.paths': () => ok(PATHS),
      'app.openPath': () => ok(undefined),
    });
    renderInShell(<DataSection />);
    for (const path of Object.values(PATHS)) expect(await screen.findByText(path)).toBeVisible();

    await user.click(screen.getByRole('button', { name: 'Open Logs folder' }));
    expect(bridge.calls).toContainEqual({ channel: 'app.openPath', input: { key: 'logs' } });
    expect(screen.queryByRole('button', { name: 'Open Settings file' })).not.toBeInTheDocument();
  });
});

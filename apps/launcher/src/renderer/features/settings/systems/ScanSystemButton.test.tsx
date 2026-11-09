import { ok, type ScanStatus } from '@nextlevel/shared';
import { screen } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { afterEach, describe, expect, it } from 'vitest';
import { setBridgeForTests } from '../../../bridge.ts';
import { installFakeBridge, renderInShell } from '../../../test-utils.tsx';
import { ScanSystemButton } from './ScanSystemButton.tsx';

afterEach(() => {
  setBridgeForTests(null);
});

const IDLE: ScanStatus = { running: false, progress: null, last: null };
const DONE: ScanStatus = {
  running: false,
  progress: null,
  last: {
    scanId: 's1',
    outcome: 'completed',
    startedAt: '2026-11-09T10:00:00.000Z',
    finishedAt: '2026-11-09T10:00:01.000Z',
    addNew: true,
    systems: [
      {
        systemId: 'custom-nintendo-switch-2',
        present: 1,
        added: 1,
        moved: 0,
        restored: 0,
        missing: 0,
      },
    ],
    enabledSystemIds: [],
  },
};

function setup(props: { unsaved?: boolean; hasLocations?: boolean } = {}) {
  let status = IDLE;
  const bridge = installFakeBridge({
    'scan.status': () => ok(status),
    'scan.start': () => {
      status = DONE;
      return ok(DONE);
    },
  });
  renderInShell(
    <ScanSystemButton
      systemId="custom-nintendo-switch-2"
      name="Nintendo Switch 2"
      unsaved={props.unsaved ?? false}
      hasLocations={props.hasLocations ?? true}
    />,
  );
  return bridge;
}

describe('ScanSystemButton (FR-LIB-3)', () => {
  it('FR-LIB-3: scans only this system and shows the result', async () => {
    const user = userEvent.setup();
    const bridge = setup();
    await user.click(await screen.findByRole('button', { name: 'Scan Nintendo Switch 2' }));
    expect(bridge.calls.find((c) => c.channel === 'scan.start')?.input).toEqual({
      systemIds: ['custom-nintendo-switch-2'],
    });
    expect(await screen.findByText('1 game in 1 system · 1 new')).toBeVisible();
  });

  it('FR-LIB-3: unsaved changes must be saved first', async () => {
    setup({ unsaved: true });
    expect(await screen.findByRole('button', { name: 'Scan Nintendo Switch 2' })).toBeDisabled();
    expect(screen.getByText('Save your changes before scanning.')).toBeVisible();
  });

  it('FR-LIB-3: without a storage location there is nothing to scan', async () => {
    setup({ hasLocations: false });
    expect(await screen.findByRole('button', { name: 'Scan Nintendo Switch 2' })).toBeDisabled();
    expect(screen.getByText('Add a storage location to scan.')).toBeVisible();
  });
});

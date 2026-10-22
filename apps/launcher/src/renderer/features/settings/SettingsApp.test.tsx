import { defaultSettings, err, ok } from '@nextlevel/shared';
import { screen, within } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { afterEach, describe, expect, it } from 'vitest';
import { setBridgeForTests } from '../../bridge.ts';
import { installFakeBridge, renderInShell, type FakeResponses } from '../../test-utils.tsx';
import { useState } from 'react';
import type { AppParams } from '../shell/windowManager.ts';
import { N64, SNES } from '../library/testing.ts';
import { SettingsApp } from './SettingsApp.tsx';

afterEach(() => {
  setBridgeForTests(null);
});

async function openAbout(responses: FakeResponses = {}) {
  const user = userEvent.setup();
  installFakeBridge(responses);
  renderInShell(<SettingsApp />);
  await user.click(screen.getByRole('button', { name: 'About' }));
}

describe('SettingsApp', () => {
  it('IA §1: opens on General, with every section in the navigation', () => {
    installFakeBridge();
    renderInShell(<SettingsApp />);
    const nav = screen.getByRole('navigation', { name: 'Settings sections' });
    for (const name of ['General', 'Storage', 'Systems', 'Backups', 'Data & logs', 'About']) {
      expect(within(nav).getByRole('button', { name })).toBeInTheDocument();
    }
    expect(screen.getByRole('button', { name: 'General', current: 'page' })).toBeInTheDocument();
  });

  it('IA §1 Settings > About: shows the version from the bridge', async () => {
    await openAbout();
    expect(screen.getByRole('button', { name: 'About', current: 'page' })).toBeInTheDocument();
    expect(await screen.findByText('Version 0.0.0')).toBeInTheDocument();
  });

  it('shows "Version unavailable" when invoke resolves an error', async () => {
    await openAbout({ 'app.version': () => err('INTERNAL', 'errors.internal') });
    expect(await screen.findByText('Version unavailable')).toBeInTheDocument();
  });

  it('shows "Version unavailable" when invoke rejects', async () => {
    await openAbout({ 'app.version': () => Promise.reject(new Error('ipc down')) });
    expect(await screen.findByText('Version unavailable')).toBeInTheDocument();
  });

  it('US-C2: opened with a section and an item, it shows that section with the item open', async () => {
    const user = userEvent.setup();
    installFakeBridge({
      'systems.catalog': () => ok([N64, SNES]),
      'emulators.presets': () => ok([]),
    });
    function Harness() {
      const [params, setParams] = useState<AppParams>({ section: 'systems', focusId: 'snes' });
      return (
        <>
          <button
            type="button"
            onClick={() => {
              setParams({ section: 'emulators' });
            }}
          >
            reopen
          </button>
          <SettingsApp params={params} />
        </>
      );
    }
    renderInShell(<Harness />);
    expect(screen.getByRole('button', { name: 'Systems', current: 'page' })).toBeInTheDocument();
    expect(await screen.findByRole('heading', { name: 'Super Nintendo' })).toBeVisible();
    await user.click(screen.getByRole('button', { name: 'reopen' }));
    expect(screen.getByRole('button', { name: 'Emulators', current: 'page' })).toBeInTheDocument();
  });

  it('US-C2: a second Fix for the open section keeps unsaved edits and reopens the item', async () => {
    const user = userEvent.setup();
    installFakeBridge({
      'systems.catalog': () => ok([N64, SNES]),
      'emulators.presets': () => ok([]),
    });
    renderInShell(
      <ReopenHarness
        steps={[
          { section: 'systems', focusId: 'snes' },
          { section: 'systems', focusId: 'snes' },
        ]}
      />,
    );
    const editor = await screen.findByRole('region', { name: 'Super Nintendo' });
    await user.type(within(editor).getByRole('textbox', { name: 'ROM folder name' }), 'X');
    await user.click(within(editor).getByRole('button', { name: 'Close' }));
    expect(screen.queryByRole('region', { name: 'Super Nintendo' })).toBeNull();
    await user.click(screen.getByRole('button', { name: 'reopen' }));
    expect(await screen.findByRole('region', { name: 'Super Nintendo' })).toBeVisible();
    expect(screen.getByRole('region', { name: 'You have unsaved changes.' })).toBeVisible();
  });

  it('US-C2: opened on Emulators with a profile, that profile’s editor is open', async () => {
    const settings = {
      ...defaultSettings(),
      emulators: [{ id: EMU, name: 'Emu', executable: 'C:\\emu\\emu.exe' }],
      profiles: [
        {
          id: PROFILE,
          name: 'Emu N64',
          emulatorId: EMU,
          systems: ['nintendo-64'],
          args: ['{rom}'],
          archives: 'pass' as const,
          env: {},
        },
      ],
    };
    installFakeBridge({
      'settings.get': () => ok({ kind: 'ok' as const, snapshot: { settings, revision: 0 } }),
      'systems.catalog': () => ok([N64, SNES]),
      'emulators.presets': () => ok([]),
      'launch.preview': () => ok({ executable: 'x', args: [], cwd: 'x', commandLine: 'x' }),
    });
    renderInShell(<SettingsApp params={{ section: 'emulators', focusId: PROFILE }} />);
    const editor = await screen.findByRole('region', { name: 'Edit profile' });
    expect(within(editor).getByRole('textbox', { name: 'Name' })).toHaveValue('Emu N64');
  });
});

const EMU = '01900000-0000-7000-8000-0000000000e1';
const PROFILE = '01900000-0000-7000-8000-000000000001';

/** Opens SettingsApp with `steps[0]`; each "reopen" click passes the next params, like a second Fix. */
function ReopenHarness({ steps }: { steps: AppParams[] }) {
  const [step, setStep] = useState(0);
  const params = steps[Math.min(step, steps.length - 1)];
  return (
    <>
      <button
        type="button"
        onClick={() => {
          setStep(step + 1);
        }}
      >
        reopen
      </button>
      <SettingsApp {...(params ? { params } : {})} />
    </>
  );
}

import {
  defaultSettings,
  ok,
  type Emulator,
  type EmulatorProfile,
  type Settings,
} from '@nextlevel/shared';
import { screen, within } from '@testing-library/react';
import { afterEach, describe, expect, it } from 'vitest';
import { setBridgeForTests } from '../../bridge.ts';
import { installFakeBridge, renderInShell } from '../../test-utils.tsx';
import { EmulatorsSection, emulatorsFor } from './EmulatorsSection.tsx';

afterEach(() => {
  setBridgeForTests(null);
});

const RETROARCH = '11111111-1111-4111-8111-111111111111';
const BSNES = '22222222-2222-4222-8222-222222222222';

const emulator = (id: string, name: string, version?: string): Emulator => ({
  id,
  name,
  executable: `C:\\Emulators\\${name}.exe`,
  ...(version === undefined ? {} : { version }),
});

let nextProfile = 0;
const profile = (name: string, emulatorId: string, systems: string[]): EmulatorProfile => {
  nextProfile += 1;
  return {
    id: `33333333-3333-4333-8333-${String(nextProfile).padStart(12, '0')}`,
    name,
    emulatorId,
    systems,
    args: ['{rom}'],
    archives: 'pass',
    squashfs: 'pass',
    entries: [],
    pointerExtensions: [],
    env: {},
  };
};

function settingsWith(emulators: Emulator[], profiles: EmulatorProfile[]): Settings {
  return { ...defaultSettings(), emulators, profiles };
}

function renderSection(settings: Settings) {
  installFakeBridge({
    'settings.get': () => ok({ kind: 'ok', snapshot: { settings, revision: 1 } }),
  });
  renderInShell(<EmulatorsSection title="Emulators" systemId="snes" />);
  return screen.getByRole('region', { name: 'Emulators' });
}

describe('emulatorsFor', () => {
  it('FR-MUS-7: emulatorsFor groups every profile listing the system under its emulator', () => {
    const retroarch = emulator(RETROARCH, 'RetroArch', '1.19');
    const bsnes = emulator(BSNES, 'bsnes');
    const snes9x = profile('Snes9x core', RETROARCH, ['snes', 'sfc']);
    const bsnesProfile = profile('bsnes', BSNES, ['snes']);
    const genesis = profile('Genesis Plus GX', RETROARCH, ['genesis']);
    const settings = settingsWith([retroarch, bsnes], [snes9x, genesis, bsnesProfile]);

    expect(emulatorsFor(settings, 'snes')).toEqual([
      { emulator: bsnes, profiles: [bsnesProfile] },
      { emulator: retroarch, profiles: [snes9x] },
    ]);
    expect(emulatorsFor(settings, 'genesis')).toEqual([
      { emulator: retroarch, profiles: [genesis] },
    ]);
    expect(emulatorsFor(settings, 'gameboy')).toEqual([]);
  });
});

describe('EmulatorsSection', () => {
  it('FR-MUS-7: a system with no profiles shows the Settings hint', async () => {
    const region = renderSection(settingsWith([emulator(RETROARCH, 'RetroArch')], []));
    expect(
      await within(region).findByText(
        'No emulator is set up for this system yet. Add one in Settings → Emulators.',
      ),
    ).toBeInTheDocument();
  });

  it('FR-MUS-7: an emulator listed by two profiles appears once with both profile names', async () => {
    const region = renderSection(
      settingsWith(
        [emulator(RETROARCH, 'RetroArch', '1.19')],
        [profile('Snes9x core', RETROARCH, ['snes']), profile('bsnes core', RETROARCH, ['snes'])],
      ),
    );
    expect(await within(region).findByText('RetroArch')).toBeInTheDocument();
    expect(within(region).getAllByText('RetroArch')).toHaveLength(1);
    expect(within(region).getByText('1.19')).toBeInTheDocument();
    const names = within(region)
      .getAllByRole('listitem')
      .map((item) => item.textContent);
    expect(names).toEqual(['bsnes core', 'Snes9x core']);
  });
});

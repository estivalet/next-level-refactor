import {
  AppErrorException,
  defaultSettings,
  EMPTY_LAUNCH_OVERRIDE,
  type EmulatorProfile,
  type Settings,
} from '@nextlevel/shared';
import { describe, expect, it } from 'vitest';
import { resolveProfile } from './resolve.ts';

const EMU = '01900000-0000-7000-8000-0000000000e1';
const P1 = '01900000-0000-7000-8000-000000000001';
const P2 = '01900000-0000-7000-8000-000000000002';
const P3 = '01900000-0000-7000-8000-000000000003';
const GONE = '01900000-0000-7000-8000-0000000000ff';

const profile = (id: string, systems: string[]): EmulatorProfile => ({
  id,
  name: id.slice(-1),
  emulatorId: EMU,
  systems,
  args: ['{rom}'],
  archives: 'pass',
  env: {},
});

function settings(overrides: Partial<Settings> = {}): Settings {
  return {
    ...defaultSettings(),
    emulators: [{ id: EMU, name: 'Emu', executable: 'E:\\emu\\emu.exe' }],
    profiles: [profile(P1, ['snes']), profile(P2, ['nintendo-64']), profile(P3, ['nintendo-64'])],
    ...overrides,
  };
}

function code(run: () => unknown): string | undefined {
  try {
    run();
  } catch (error) {
    if (error instanceof AppErrorException) return error.error.code;
    throw error;
  }
  return undefined;
}

describe('resolveProfile (data model §2.3)', () => {
  it('FR-EMU-4: without override or default, the first profile covering the system wins', () => {
    expect(resolveProfile(settings(), 'nintendo-64', EMPTY_LAUNCH_OVERRIDE).profile.id).toBe(P2);
  });

  it('FR-EMU-4: the system default beats list order', () => {
    const s = settings({ systems: { 'nintendo-64': { enabled: true, defaultProfileId: P3 } } });
    expect(resolveProfile(s, 'nintendo-64', EMPTY_LAUNCH_OVERRIDE).profile.id).toBe(P3);
  });

  it('FR-EMU-4: a game override beats the system default', () => {
    const s = settings({ systems: { 'nintendo-64': { enabled: true, defaultProfileId: P3 } } });
    const override = { ...EMPTY_LAUNCH_OVERRIDE, profileId: P2 };
    expect(resolveProfile(s, 'nintendo-64', override)).toMatchObject({
      profile: { id: P2 },
      emulator: { id: EMU },
    });
  });

  it('FR-EMU-4: deleted override and default profiles fall through', () => {
    const s = settings({ systems: { 'nintendo-64': { enabled: true, defaultProfileId: GONE } } });
    const override = { ...EMPTY_LAUNCH_OVERRIDE, profileId: GONE };
    expect(resolveProfile(s, 'nintendo-64', override).profile.id).toBe(P2);
  });

  it('FR-EMU-4: a default or override profile that no longer covers the system falls through', () => {
    const s = settings({ systems: { 'nintendo-64': { enabled: true, defaultProfileId: P1 } } });
    expect(resolveProfile(s, 'nintendo-64', EMPTY_LAUNCH_OVERRIDE).profile.id).toBe(P2);
    const override = { ...EMPTY_LAUNCH_OVERRIDE, profileId: P1 };
    expect(resolveProfile(settings(), 'nintendo-64', override).profile.id).toBe(P2);
  });

  it('US-C2: no profile for the system → NO_PROFILE with a fix link to the system', () => {
    try {
      resolveProfile(settings(), 'sega-saturn', EMPTY_LAUNCH_OVERRIDE);
      expect.fail('should throw');
    } catch (error) {
      expect((error as AppErrorException).error).toMatchObject({
        code: 'NO_PROFILE',
        details: { fix: { section: 'systems', id: 'sega-saturn' } },
      });
    }
  });

  it('US-C2: a profile whose emulator is gone → EMULATOR_MISSING', () => {
    expect(
      code(() => resolveProfile(settings({ emulators: [] }), 'snes', EMPTY_LAUNCH_OVERRIDE)),
    ).toBe('EMULATOR_MISSING');
  });
});

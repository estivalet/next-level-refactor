import { defaultSettings, type Settings } from '@nextlevel/shared';
import { describe, expect, it } from 'vitest';
import { markExistingSetupComplete } from './setupComplete.ts';

const NOW = new Date('2026-10-30T10:00:00.000Z');
const withLocation = (settings: Settings): Settings => ({
  ...settings,
  storage: {
    ...settings.storage,
    locations: [
      { id: '0192f000-0000-7000-8000-000000000001', name: 'ROMs', path: 'D:\\ROMs', priority: 1 },
    ],
  },
});

describe('existing installs skip the first-run wizard (D48)', () => {
  it('an existing install (a storage location or games) is marked complete', () => {
    expect(
      markExistingSetupComplete(withLocation(defaultSettings()), 0, NOW)?.general.setupCompletedAt,
    ).toBe(NOW.toISOString());
    expect(markExistingSetupComplete(defaultSettings(), 3, NOW)?.general.setupCompletedAt).toBe(
      NOW.toISOString(),
    );
  });

  it('a fresh install, or one already complete, is left alone', () => {
    expect(markExistingSetupComplete(defaultSettings(), 0, NOW)).toBeNull();
    const done = withLocation(defaultSettings());
    done.general = { ...done.general, setupCompletedAt: '2026-01-01T00:00:00.000Z' };
    expect(markExistingSetupComplete(done, 9, NOW)).toBeNull();
  });

  it('D48: after Run setup again an install with folders still gets the wizard at the next start', () => {
    const requested = withLocation(defaultSettings());
    requested.general = { ...requested.general, setupCompletedAt: null, setupRequested: true };
    expect(markExistingSetupComplete(requested, 12, NOW)).toBeNull();
  });
});

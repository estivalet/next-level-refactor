import { describe, expect, it } from 'vitest';
import type { EmulatorProfile } from '../settings/emulators.ts';
import { defaultSettings, type Settings } from '../settings/schema.ts';
import { defaultProfileFor, profilesFor } from './profiles.ts';

const EMU = '01900000-0000-7000-8000-0000000000e1';
const P1 = '01900000-0000-7000-8000-000000000001';
const P2 = '01900000-0000-7000-8000-000000000002';
const P3 = '01900000-0000-7000-8000-000000000003';

const profile = (id: string, systems: string[]): EmulatorProfile => ({
  id,
  name: id.slice(-1),
  emulatorId: EMU,
  systems,
  args: ['{rom}'],
  archives: 'pass',
  env: {},
});

const settings = (systems: Settings['systems'] = {}): Settings => ({
  ...defaultSettings(),
  profiles: [profile(P1, ['snes']), profile(P2, ['nintendo-64']), profile(P3, ['nintendo-64'])],
  systems,
});

describe('profilesFor / defaultProfileFor (data model §2.3, FR-EMU-4)', () => {
  it('FR-EMU-4: the profiles covering a system, in list order', () => {
    expect(profilesFor(settings(), 'nintendo-64').map((p) => p.id)).toEqual([P2, P3]);
  });

  it('FR-EMU-4: the system default wins when it still covers the system', () => {
    const s = settings({ 'nintendo-64': { enabled: true, defaultProfileId: P3 } });
    expect(defaultProfileFor(s, 'nintendo-64')?.id).toBe(P3);
  });

  it('FR-EMU-4: a default that no longer covers the system falls back to the first profile', () => {
    const s = settings({ 'nintendo-64': { enabled: true, defaultProfileId: P1 } });
    expect(defaultProfileFor(s, 'nintendo-64')?.id).toBe(P2);
  });

  it('FR-EMU-4: no profile for the system → undefined', () => {
    expect(defaultProfileFor(settings(), 'sega-saturn')).toBeUndefined();
  });
});

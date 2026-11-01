import {
  defaultProfileFor,
  usesToken,
  type EmulatorProfile,
  type ImportItem,
  type Settings,
} from '@nextlevel/shared';

/** Emulator presets NextLevelOS's runner started with `-uimodekey DEL`. */
const MAME_FAMILY = new Set(['mame', 'hbmame']);
const UI_KEY = ['-uimodekey', 'DEL'];

/** Before `-skip_gameinfo`, else before `{extraArgs}`, else at the end. */
function withUiKey(profile: EmulatorProfile): EmulatorProfile {
  const skip = profile.args.indexOf('-skip_gameinfo');
  const extra = profile.args.findIndex((arg) => usesToken(arg, 'extraArgs'));
  const at = skip >= 0 ? skip : extra >= 0 ? extra : profile.args.length;
  return { ...profile, args: [...profile.args.slice(0, at), ...UI_KEY, ...profile.args.slice(at)] };
}

/**
 * NextLevelOS started MAME and HBMAME with `-uimodekey DEL` (Delete toggles MAME's UI). Each
 * imported system's default profile that runs one of them and doesn't choose a UI key gets it;
 * the profile changes in place, so importing again changes nothing.
 */
export function addMameUiKey(
  settings: Settings,
  systemIds: readonly string[],
): { next: Settings; items: ImportItem[] } {
  const changed = new Set<string>();
  for (const systemId of systemIds) {
    const profile = defaultProfileFor(settings, systemId);
    const emulator = settings.emulators.find((e) => e.id === profile?.emulatorId);
    if (!profile || !MAME_FAMILY.has(emulator?.presetId ?? '')) continue;
    if (!profile.args.includes('-uimodekey')) changed.add(profile.id);
  }
  if (changed.size === 0) return { next: settings, items: [] };
  const next = {
    ...settings,
    profiles: settings.profiles.map((p) => (changed.has(p.id) ? withUiKey(p) : p)),
  };
  const item: ImportItem = {
    area: 'emulator',
    key: 'MAME',
    reason: 'mameUiModeKey',
    detail: UI_KEY.join(' '),
    count: changed.size,
  };
  return { next, items: [item] };
}

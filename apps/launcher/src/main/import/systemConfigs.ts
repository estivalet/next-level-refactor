import {
  defaultProfileFor,
  usesToken,
  type EmulatorProfile,
  type ImportItem,
  type Settings,
} from '@nextlevel/shared';

/** A NextLevelOS system's own RetroArch config, `<RA>\config\<system name>.cfg`, found on disk. */
export interface SystemConfig {
  systemId: string;
  /** The NextLevelOS system name: the file's name and the report key. */
  name: string;
  path: string;
}

/** Profile names are at most 80 characters (settings schema). */
const MAX_NAME = 80;

/** `{` and `}` start tokens in templates (data model §2.1); a path keeps them as text. */
const literal = (text: string) => text.replaceAll('{', '{{').replaceAll('}', '}}');

function withConfig(profile: EmulatorProfile, config: SystemConfig, id: string): EmulatorProfile {
  // Right after the core argument (0 when there is none), so the game's own -c in {extraArgs}
  // comes later and wins: RetroArch keeps the last -c it reads.
  const at = profile.args.findIndex((arg) => usesToken(arg, 'core')) + 1;
  return {
    ...profile,
    id,
    name: `${profile.name} · ${config.name}`.slice(0, MAX_NAME).trim(),
    systems: [config.systemId],
    args: [...profile.args.slice(0, at), '-c', literal(config.path), ...profile.args.slice(at)],
  };
}

/**
 * NextLevelOS starts RetroArch with `-c <RA>\config\<system>.cfg` (nextlevel-launcher.py). Each
 * system with that file whose default profile runs RetroArch gets a copy of the profile for that
 * system alone, with the `-c`, as its default; the shared profile stays as it was. A default that
 * already passes `-c` is left alone, so importing again changes nothing.
 */
export function addSystemConfigs(
  settings: Settings,
  configs: readonly SystemConfig[],
  newId: () => string,
): { next: Settings; items: ImportItem[] } {
  let next = settings;
  const items: ImportItem[] = [];
  for (const config of configs) {
    const own = next.systems[config.systemId];
    const profile = defaultProfileFor(next, config.systemId);
    const emulator = next.emulators.find((e) => e.id === profile?.emulatorId);
    if (!own || !profile || emulator?.presetId !== 'retroarch' || profile.args.includes('-c')) {
      continue;
    }
    const copy = withConfig(profile, config, newId());
    next = {
      ...next,
      profiles: [...next.profiles, copy],
      systems: { ...next.systems, [config.systemId]: { ...own, defaultProfileId: copy.id } },
    };
    items.push({
      area: 'system',
      key: config.name,
      reason: 'retroarchSystemConfig',
      detail: config.path,
    });
  }
  return { next, items };
}

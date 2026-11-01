// Builds data/presets.json and each system's presetProfiles (FR-EMU-7, data model §3) from
// NextLevelOS's launchers.json and runner tables plus presetTables.ts. Dev-only.

import type { EmulatorPreset, PresetCatalog, PresetProfile } from '@nextlevel/shared';
import {
  MAME,
  MAME_MEDIA,
  MAME_METHODS,
  RETROARCH,
  STANDALONE,
  type MameVariant,
} from './presetTables.ts';
import type { MameEntry } from './runner.ts';

export interface PresetInput {
  launchers: Record<string, { command?: string }>;
  /** Runner SYSTEM_EMULATORS: system name → emulator keys, preferred first. */
  systemEmulators: Record<string, string[]>;
  mameArgs: Record<string, MameEntry>;
  /** System name → most common per-game core, for systems whose command uses %core%. */
  gamelistCores: Record<string, string>;
  /** NextLevelOS system name → catalog id, for the systems in the catalog. */
  systemIds: ReadonlyMap<string, string>;
  source: string;
}

export interface PresetResult {
  catalog: PresetCatalog;
  /** Catalog id → preset profile ids, best first. */
  presetProfiles: Record<string, string[]>;
  /** `<system>: <emulator key>` pairs with no preset. */
  skipped: string[];
}

const RETROARCH_ARGS = ['-L', '{emulatorDir}\\cores\\{core}.dll', '{extraArgs}', '{rom}'];

/** Template text with literal braces escaped. */
const literal = (text: string) => text.replace(/[{}]/g, (brace) => brace + brace);

/**
 * What the runner passes every MAME launch that isn't a default of MAME's own folder: Delete
 * toggles the UI (instead of MAME's default key), and no game info screen.
 */
export const MAME_COMMON = ['-uimodekey', 'DEL', '-skip_gameinfo'] as const;

/** Runner MAME arguments → template args; `%COMMANDS%` autoboot pairs are dropped (D2). */
export function mameProfileArgs(entry: readonly string[], medium?: string): string[] {
  const args: string[] = [];
  for (let i = 0; i < entry.length; i += 1) {
    const arg = entry[i] ?? '';
    if (arg === '-autoboot_delay' && entry[i + 3] === '%COMMANDS%') {
      i += 3;
      continue;
    }
    if (arg === '-autoboot_command' && entry[i + 1] === '%COMMANDS%') {
      i += 1;
      continue;
    }
    args.push(
      literal(arg)
        .replace('-%MEDIA%', `-${medium ?? 'MEDIA'}`)
        .replaceAll('%ROM_PATH%', '{rom}')
        .replaceAll('%SYSTEM_PATH%', '{systemDir}')
        .replaceAll('%CORE%', '{core}'),
    );
  }
  const hasRompath = args.includes('-rp') || args.includes('-rompath');
  return [
    ...args,
    ...(hasRompath ? [] : ['-rompath', '{systemDir}']),
    ...MAME_COMMON,
    '{extraArgs}',
  ];
}

/** The most frequent `core` among a NextLevelOS gamelist's games (an array or `{ games }`). */
export function mostCommonCore(gamelist: unknown): string | undefined {
  const games: unknown[] = Array.isArray(gamelist)
    ? gamelist
    : ((gamelist as { games?: unknown[] } | null)?.games ?? []);
  const counts = new Map<string, number>();
  for (const game of games) {
    const core = (game as { core?: unknown } | null)?.core;
    if (typeof core === 'string' && core) counts.set(core, (counts.get(core) ?? 0) + 1);
  }
  return [...counts].sort((a, b) => b[1] - a[1])[0]?.[0];
}

function retroarchCore(input: PresetInput, name: string): string | undefined {
  const fixed = /-c\s+"([^"%]+)"/.exec(input.launchers[name]?.command ?? '')?.[1];
  return fixed ?? input.gamelistCores[name];
}

/** One MAME profile to build: `suffix` names a non-default variant, `medium` fills -%MEDIA%. */
interface Variant {
  args: readonly string[] | 'arcade';
  suffix?: string;
  medium?: string;
}

/** The MAME variants of one system, default first; none when the entry can't be mapped. */
function mameVariants(name: string, entry: MameEntry | undefined): Variant[] {
  if (!entry) return [{ args: 'arcade' }];
  if (!Array.isArray(entry)) {
    return (MAME_METHODS[name] ?? []).map((v: MameVariant) => ({
      args: v.args,
      ...(v.medium ? { suffix: v.medium } : {}),
    }));
  }
  if (!entry.includes('-%MEDIA%')) return [{ args: entry }];
  return (MAME_MEDIA[name] ?? []).map((medium, index) => ({
    args: entry,
    medium,
    ...(index > 0 ? { suffix: medium } : {}),
  }));
}

export function buildPresets(input: PresetInput): PresetResult {
  const presetProfiles: Record<string, string[]> = {};
  const skipped: string[] = [];
  const raSystems = new Map<string, string[]>();
  const mameProfiles: PresetProfile[] = [];
  const standaloneSystems = new Map<string, string[]>(STANDALONE.map((s) => [s.id, []]));
  const add = (id: string, profileId: string) => {
    const list = (presetProfiles[id] ??= []);
    if (!list.includes(profileId)) list.push(profileId);
  };

  for (const [name, keys] of Object.entries(input.systemEmulators)) {
    const id = input.systemIds.get(name);
    if (!id) continue;
    for (const key of keys) {
      if (key === 'retroarch') {
        const core = retroarchCore(input, name);
        if (!core) continue;
        raSystems.set(core, [...(raSystems.get(core) ?? []), id]);
        add(id, `retroarch:${core.toLowerCase()}`);
      } else if (key === 'mame') {
        const variants = mameVariants(name, input.mameArgs[name]);
        if (variants.length === 0) skipped.push(`${name}: mame (no default arguments)`);
        for (const variant of variants) {
          const profile = mameProfile(name, id, variant);
          mameProfiles.push(profile);
          add(id, profile.id);
        }
      } else {
        const spec = STANDALONE.find((s) => s.runnerKeys.includes(key));
        if (!spec) {
          skipped.push(`${name}: ${key}`);
          continue;
        }
        standaloneSystems.get(spec.id)?.push(id);
        add(id, `${spec.id}:default`);
      }
    }
  }
  for (const spec of STANDALONE) {
    for (const name of spec.extraSystems) {
      const id = input.systemIds.get(name);
      if (!id) continue;
      standaloneSystems.get(spec.id)?.push(id);
      add(id, `${spec.id}:default`);
    }
  }

  const presets: EmulatorPreset[] = [];
  const raProfiles = [...raSystems].map(([core, systems]): PresetProfile => ({
    id: `retroarch:${core.toLowerCase()}`,
    name: `RetroArch – ${core.replace(/_libretro$/, '')}`,
    systems: unique(systems),
    args: RETROARCH_ARGS,
    core,
    archives: 'pass',
  }));
  if (raProfiles.length > 0) presets.push({ ...RETROARCH, profiles: byId(raProfiles) });
  if (mameProfiles.length > 0) presets.push({ ...MAME, profiles: byId(mameProfiles) });
  for (const spec of STANDALONE) {
    const systems = unique(standaloneSystems.get(spec.id) ?? []);
    if (systems.length === 0) continue;
    const { id, name, executableNames, homepage, args, archives } = spec;
    presets.push({
      id,
      name,
      executableNames,
      homepage,
      // FR-EMU-4: a game's extra arguments go first, before flags like `-e {rom}` or `-- {rom}`.
      profiles: [{ id: `${id}:default`, name, systems, args: ['{extraArgs}', ...args], archives }],
    });
  }
  return { catalog: { source: input.source, presets }, presetProfiles, skipped };
}

function mameProfile(name: string, id: string, variant: Variant): PresetProfile {
  const args =
    variant.args === 'arcade'
      ? ['{romName}', '-rompath', '{romDir}', ...MAME_COMMON, '{extraArgs}']
      : mameProfileArgs(variant.args, variant.medium);
  return {
    id: variant.suffix ? `mame:${id}:${variant.suffix}` : `mame:${id}`,
    name: variant.suffix ? `MAME – ${name} (${variant.suffix})` : `MAME – ${name}`,
    systems: [id],
    args,
    archives: 'pass',
  };
}

const unique = (ids: readonly string[]) => [...new Set(ids)].sort();
const byId = (profiles: PresetProfile[]) => profiles.sort((a, b) => a.id.localeCompare(b.id));

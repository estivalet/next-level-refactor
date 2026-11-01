import {
  defaultProfileFor,
  type EmulatorPreset,
  type ImportItem,
  type Settings,
} from '@nextlevel/shared';
import type { GameImport } from './mapGames.ts';

/**
 * A NextLevelOS `launch_args` autoboot command as MAME should get it. Its users escaped quotes for
 * NextLevelOS's command line (`\"`, `&quot;`, `\&quot;`, or `""` inside the quoted argument), which
 * stripped them before MAME saw them; the rebuild passes the argument as is, so they become plain
 * quotes. `\n` stays: MAME types it as Enter.
 */
export function autobootText(raw: string): string {
  return raw
    .replaceAll('""', '"')
    .replaceAll('\\&quot;', '"')
    .replaceAll('&quot;', '"')
    .replaceAll('\\"', '"');
}

/** The autoboot delay of the preset profile a game runs with, if it has one. */
function delayFor(
  game: GameImport,
  settings: Settings,
  presets: readonly EmulatorPreset[],
): string | undefined {
  const presetProfileId =
    game.presetProfileId ?? defaultProfileFor(settings, game.systemId)?.presetProfileId;
  if (!presetProfileId) return undefined;
  const preset = presets.find((p) => p.id === presetProfileId.split(':')[0]);
  return preset?.profiles.find((p) => p.id === presetProfileId)?.autobootDelay;
}

/**
 * Games with their own MAME autoboot command (FR-EMU-4): NextLevelOS typed it after the system's
 * delay (`-autoboot_delay N -autoboot_command <text>`); the rebuild passes the same as extra
 * arguments, when the profile the game runs with has that delay. Others are reported.
 */
export function addAutoboot(
  games: readonly GameImport[],
  settings: Settings,
  presets: readonly EmulatorPreset[],
  /** The report key for a system (its NextLevelOS name). */
  nameOf: (systemId: string) => string = (systemId) => systemId,
): { games: GameImport[]; items: ImportItem[] } {
  const mapped = new Map<string, number>();
  const left = new Map<string, number>();
  const next = games.map((game): GameImport => {
    if (!game.autoboot) return game;
    const delay = delayFor(game, settings, presets);
    const counts = delay ? mapped : left;
    const key = nameOf(game.systemId);
    counts.set(key, (counts.get(key) ?? 0) + 1);
    if (!delay) return game;
    const autoboot = ['-autoboot_delay', delay, '-autoboot_command', game.autoboot];
    return {
      ...game,
      override: {
        core: game.override?.core ?? null,
        extraArgs: [...(game.override?.extraArgs ?? []), ...autoboot],
      },
    };
  });
  const items = [
    ...[...mapped].map(([key, count]): ImportItem => ({
      area: 'game',
      key,
      reason: 'mameAutoboot',
      count,
    })),
    ...[...left].map(([key, count]): ImportItem => ({
      area: 'game',
      key,
      reason: 'perGameEmulator',
      count,
    })),
  ];
  return { games: next, items };
}

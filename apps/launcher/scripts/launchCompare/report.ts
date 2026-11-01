import { ACCEPTED } from './accepted.ts';
import {
  argDiff,
  normalize,
  OUTCOMES,
  SAME_EFFECT,
  templated,
  type Built,
  type Outcome,
  type Placeholders,
} from './compare.ts';
import type { NewBuilt } from './newCommand.ts';

export interface OldBuilt extends Built {
  /** Squashfs images the runner would mount first (not mounted here). */
  mounts: Array<{ image: string; internal: string }>;
}

/** One launch variant of a system: its first game, compared. */
export interface Row {
  system: string;
  systemId: string | null;
  sample: string;
  games: number;
  fields: Record<string, string>;
  old: OldBuilt;
  next: NewBuilt;
  placeholders: Placeholders;
  outcome: Outcome;
  /** The accepted.ts rule id when `outcome` is accepted. */
  accepted: string | null;
}

export interface ReportInput {
  date: string;
  nextLevelOS: string;
  dataDir: string;
  rows: readonly Row[];
  /** launchers.json systems without a gamelist (nothing to compare). */
  noGamelist: readonly string[];
  /** Compared as if NextLevelOS were imported again now. */
  reimport: boolean;
  exists: (path: string) => boolean;
}

const SYSTEMS_PER_DIFFERENCE = 25;
const COMMON_DIFFERENCES = 40;

const OUTCOME_TEXT: Record<Outcome, string> = {
  match: 'Same program, arguments, working folder and environment',
  cwdOrEnv: 'Same program and arguments; working folder or environment differs',
  order: 'Same program and arguments, in another order',
  missingConfig:
    'Same, except NextLevelOS also appends a config file that isn’t there (RetroArch skips it)',
  accepted: 'A known difference that is fine (see Accepted differences)',
  args: 'Same program, different arguments',
  emulator: 'A different program',
  newError: 'Only the rebuild can’t build a command',
  oldError: 'Only NextLevelOS can’t build a command',
  bothError: 'Neither can build a command',
};

const cell = (value: string) => value.replaceAll('|', '\\|').replaceAll('\n', ' ');
const code = (value: string) => (value ? `\`${cell(value)}\`` : '—');
const quote = (arg: string) => (arg === '' || /\s/.test(arg) ? `"${arg}"` : arg);
const commandLine = (built: Built) =>
  built.exe === null ? '' : [built.exe, ...built.args].map(quote).join(' ');

function sum(rows: readonly Row[]) {
  return rows.reduce((total, row) => total + row.games, 0);
}

/** `Map.groupBy` (ES2024, newer than the project's lib). */
function groupBy<T>(items: readonly T[], key: (item: T) => string): Map<string, T[]> {
  const groups = new Map<string, T[]>();
  for (const item of items) {
    const group = groups.get(key(item));
    if (group) group.push(item);
    else groups.set(key(item), [item]);
  }
  return groups;
}

function outcomeSummary(rows: readonly Row[]): string {
  const counts = new Map<Outcome, number>();
  for (const row of rows) counts.set(row.outcome, (counts.get(row.outcome) ?? 0) + 1);
  return OUTCOMES.filter((outcome) => counts.has(outcome))
    .map((outcome) => `${String(counts.get(outcome) ?? 0)} ${outcome}`)
    .join(', ');
}

function systemTable(rows: readonly Row[]): string[] {
  const bySystem = groupBy(rows, (row) => row.system);
  const lines = [
    '| System | Rebuild id | Games | Variants | Result | NextLevelOS program | Rebuild profile |',
    '| :--- | :--- | ---: | ---: | :--- | :--- | :--- |',
  ];
  const ordered = [...bySystem.entries()].sort(
    ([a, aRows], [b, bRows]) =>
      Number(aRows.every((r) => r.outcome === 'match')) -
        Number(bRows.every((r) => r.outcome === 'match')) || a.localeCompare(b),
  );
  for (const [system, systemRows] of ordered) {
    const first = systemRows[0];
    if (!first) continue;
    const olds = [...new Set(systemRows.map((r) => r.old.exe?.split(/[\\/]/).pop() ?? '—'))];
    const news = [...new Set(systemRows.map((r) => r.next.profileName ?? r.next.error ?? '—'))];
    lines.push(
      `| ${cell(system)} | ${code(first.systemId ?? '')} | ${String(sum(systemRows))} | ${String(systemRows.length)} | ${outcomeSummary(systemRows)} | ${cell(olds.join(', '))} | ${cell(news.join(', '))} |`,
    );
  }
  return lines;
}

/** One game per program the rebuild starts (one whose command matches NextLevelOS's when there is one). */
function handTests(rows: readonly Row[]): string[] {
  const runnable = rows.filter((row) => row.next.exe !== null);
  const byExe = groupBy(runnable, (row) => normalize(row.next.exe ?? ''));
  const lines = [
    '| Program | Systems | Try this game | System | Same command as NextLevelOS |',
    '| :--- | ---: | :--- | :--- | :--- |',
  ];
  const groups = [...byExe.values()].sort((a, b) => sum(b) - sum(a));
  for (const group of groups) {
    const pick = group.find((row) => SAME_EFFECT.has(row.outcome)) ?? group[0];
    if (!pick?.next.exe) continue;
    const systems = new Set(group.map((row) => row.system)).size;
    lines.push(
      `| ${code(pick.next.exe)} | ${String(systems)} | ${code(pick.sample)} | ${cell(pick.system)} | ${SAME_EFFECT.has(pick.outcome) ? 'yes' : `no (${pick.outcome})`} |`,
    );
  }
  return lines;
}

const diffOf = (row: Row) => argDiff(row.old.args, row.next.args, row.placeholders);

/** For an only-old argument that is an absolute path: whether it's missing on disk; else null. */
function missingPath(row: Row, arg: string, exists: (path: string) => boolean): boolean | null {
  const source = row.old.args.find(
    (value) => /^[a-z]:[\\/]/i.test(value) && templated(value, row.placeholders) === arg,
  );
  return source === undefined ? null : !exists(source);
}

interface Difference {
  side: 'old' | 'new';
  arg: string;
  variants: number;
  games: number;
  /** Variants where this old path isn't on disk. */
  missing: number;
  paths: number;
  systems: Set<string>;
}

/** The arguments only one side passes, counted over every variant with the same program. */
function commonDifferences(rows: readonly Row[], exists: (path: string) => boolean): string[] {
  const counts = new Map<string, Difference>();
  for (const row of rows.filter((r) => r.outcome === 'args')) {
    const { onlyOld, onlyNew } = diffOf(row);
    const sides = [
      ...[...new Set(onlyOld)].map((arg) => ['old', arg] as const),
      ...[...new Set(onlyNew)].map((arg) => ['new', arg] as const),
    ];
    for (const [side, arg] of sides) {
      const key = `${side}\u0000${arg}`;
      const entry = counts.get(key) ?? {
        side,
        arg,
        variants: 0,
        games: 0,
        missing: 0,
        paths: 0,
        systems: new Set<string>(),
      };
      entry.variants += 1;
      entry.games += row.games;
      entry.systems.add(row.system);
      const missing = side === 'old' ? missingPath(row, arg, exists) : null;
      if (missing !== null) entry.paths += 1;
      if (missing) entry.missing += 1;
      counts.set(key, entry);
    }
  }
  const top = [...counts.values()].sort((a, b) => b.games - a.games).slice(0, COMMON_DIFFERENCES);
  return [
    '| Only in | Argument | Systems | Variants | Games | Missing on disk |',
    '| :--- | :--- | ---: | ---: | ---: | ---: |',
    ...top.map(
      (e) =>
        `| ${e.side === 'old' ? 'NextLevelOS' : 'rebuild'} | ${code(e.arg)} | ${String(e.systems.size)} | ${String(e.variants)} | ${String(e.games)} | ${e.paths > 0 ? `${String(e.missing)} of ${String(e.paths)}` : ''} |`,
    ),
  ];
}

/** Each accepted rule with what it covers. */
function acceptedTable(rows: readonly Row[]): string[] {
  const lines = [
    '| Rule | Why | Systems | Variants | Games |',
    '| :--- | :--- | :--- | ---: | ---: |',
  ];
  for (const rule of ACCEPTED) {
    const covered = rows.filter((row) => row.accepted === rule.id);
    if (covered.length === 0) continue;
    lines.push(
      `| ${code(rule.id)} | ${cell(rule.reason)} | ${cell(systemList(covered, 8))} | ${String(covered.length)} | ${String(sum(covered))} |`,
    );
  }
  return lines;
}

function variantFields(row: Row): string {
  const set = Object.entries(row.fields).map(([key, value]) => `${key}=${value}`);
  return set.length > 0 ? ` — ${set.map(code).join(', ')}` : '';
}

/** An only-old argument, marked when it names a file or folder that isn't there. */
function oldArg(row: Row, arg: string, exists: (path: string) => boolean): string {
  return quote(arg) + (missingPath(row, arg, exists) ? ' (missing)' : '');
}

function diffLines(row: Row, exists: (path: string) => boolean): string[] {
  const { onlyOld, onlyNew } = diffOf(row);
  return [
    ...(onlyOld.length > 0
      ? [`only old: ${onlyOld.map((arg) => oldArg(row, arg, exists)).join(' ')}`]
      : []),
    ...(onlyNew.length > 0 ? [`only new: ${onlyNew.map(quote).join(' ')}`] : []),
  ];
}

const program = (built: Built) => built.exe?.split(/[\\/]/).pop()?.toLowerCase() ?? '';

/** What differs, without the game: rows with the same signature are one difference. */
function signature(row: Row): string {
  const oldError = templated(row.old.error ?? '', row.placeholders);
  const parts: Record<Outcome, () => unknown[]> = {
    match: () => [],
    cwdOrEnv: () => [normalize(row.old.cwd ?? ''), normalize(row.next.cwd ?? ''), row.old.env],
    order: () => [],
    missingConfig: () => [],
    accepted: () => [row.accepted],
    args: () => Object.values(diffOf(row)),
    emulator: () => [program(row.old), program(row.next)],
    newError: () => [row.next.error, program(row.old)],
    oldError: () => [oldError],
    bothError: () => [row.next.error, oldError],
  };
  return JSON.stringify([row.outcome, ...parts[row.outcome]()]);
}

const plural = (count: number, word: string) => `${String(count)} ${word}${count === 1 ? '' : 's'}`;

/** Systems by name, at most `limit`, then how many more. */
function systemList(rows: readonly Row[], limit: number): string {
  const names = [...new Set(rows.map((row) => row.system))].sort((a, b) => a.localeCompare(b));
  const shown = names.slice(0, limit).join(', ');
  return names.length > limit ? `${shown} and ${String(names.length - limit)} more` : shown;
}

/** Every difference once, with the systems it affects and one example (the variant with most games). */
function details(rows: readonly Row[], exists: (path: string) => boolean): string[] {
  const lines: string[] = [];
  const different = rows.filter(
    (row) =>
      row.outcome !== 'match' && row.outcome !== 'missingConfig' && row.outcome !== 'accepted',
  );
  const groups = [...groupBy(different, signature).values()].sort((a, b) => sum(b) - sum(a));
  groups.forEach((group, index) => {
    const row = [...group].sort((a, b) => b.games - a.games)[0];
    if (!row) return;
    const systems = new Set(group.map((r) => r.system)).size;
    lines.push(
      `### ${String(index + 1)}. ${row.outcome} — ${plural(systems, 'system')}, ${plural(group.length, 'variant')}, ${plural(sum(group), 'game')}`,
      '',
      `Systems: ${cell(systemList(group, SYSTEMS_PER_DIFFERENCE))}.`,
      '',
      `Example: ${cell(row.system)} · ${code(row.sample)} (${plural(row.games, 'game')})${variantFields(row)}`,
    );
    {
      const block = [
        `old: ${row.old.error ? `ERROR ${row.old.error}` : commandLine(row.old)}`,
        ...(row.old.error ? [] : [`     cwd: ${row.old.cwd ?? '(launcher folder)'}`]),
        ...Object.entries(row.old.env).map(([key, value]) => `     env: ${key}=${value}`),
        ...row.old.mounts.map((m) => `     mounts first: ${m.image} → ${m.internal || '(root)'}`),
        `new: ${row.next.error ? `ERROR ${row.next.error}` : commandLine(row.next)}`,
        ...(row.next.profileName ? [`     profile: ${row.next.profileName}`] : []),
        ...(row.next.error ? [] : [`     cwd: ${row.next.cwd ?? ''}`]),
        ...Object.entries(row.next.env).map(([key, value]) => `     env: ${key}=${value}`),
        ...row.next.notes.map((note) => `     note: ${note}`),
        ...(row.outcome === 'args' || row.outcome === 'emulator' ? diffLines(row, exists) : []),
      ];
      lines.push('', '```text', ...block, '```', '');
    }
  });
  return lines;
}

export function renderReport(input: ReportInput): string {
  const { rows } = input;
  const summary = OUTCOMES.map((outcome) => {
    const matching = rows.filter((row) => row.outcome === outcome);
    return `| ${outcome} | ${OUTCOME_TEXT[outcome]} | ${String(matching.length)} | ${String(sum(matching))} |`;
  });
  return [
    '# Launch comparison: NextLevelOS → rebuild',
    '',
    `Generated ${input.date} by \`npm run compare-launch -w apps/launcher\`. Don’t edit it by hand: rerun the script after changing emulators, profiles or the importer.`,
    '',
    `- **NextLevelOS** (read only): \`${input.nextLevelOS}\` — \`launchers.json\`, the system gamelists and \`nextlevel-launcher.py\`.`,
    `- **Rebuild** (read only): \`${input.dataDir}\` — \`settings.json\` and \`library.db\`${input.reimport ? ', as if **Import NextLevelOS** ran again now (--reimport)' : ''}.`,
    '',
    '## How it compares',
    '',
    '- Each system’s games are grouped by their launch fields (`core`, `config`, `alt_core`, `alt_game_config`, `shader`, `emulator`, `artfolder`, `launch_args`, `mame_media`, `squashfs_exe`). The first game of each group is the sample, so per-game settings are compared too.',
    '- **NextLevelOS:** the command `electron/main.cjs` builds, then `nextlevel-launcher.py`’s own `main()` with every process caught instead of run. Squashfs images are not mounted: the mount’s path shows as `<squashfs mount>`.',
    '- **Rebuild:** the game’s launch override from the library, then the same `resolveProfile` → `locateRom` → `buildCommand` steps as `LaunchService`. Archives are not extracted.',
    '- Paths are compared without case and with either slash. Nothing is started.',
    '',
    '## Summary',
    '',
    '| Outcome | Meaning | Variants | Games |',
    '| :--- | :--- | ---: | ---: |',
    ...summary,
    '',
    `${String(input.noGamelist.length)} systems in \`launchers.json\` have no gamelist: ${input.noGamelist.map(code).join(', ') || '—'}.`,
    '',
    '## Accepted differences',
    '',
    'Differences that are fine on purpose (`scripts/launchCompare/accepted.ts`). Each is checked: the old command, changed only that way, builds the same command.',
    '',
    ...acceptedTable(rows),
    '',
    '## Start these by hand',
    '',
    'The comparison checks the commands; it can’t show an emulator starts. Start one game per program the rebuild runs, once:',
    '',
    ...handTests(rows),
    '',
    'Then go through **Differences** below.',
    '',
    '## Most common argument differences',
    '',
    `For the **args** outcome: arguments only one launcher passes, lowercased, with the game’s paths shown as \`{rom}\`, \`{systemDir}\` and \`{emulatorDir}\`. Top ${String(COMMON_DIFFERENCES)} by games.`,
    '',
    ...commonDifferences(rows, input.exists),
    '',
    '## Systems',
    '',
    'Systems with a difference first.',
    '',
    ...systemTable(rows),
    '',
    '## Differences',
    '',
    'Each difference once, most games first, with the systems it affects and the variant with most games as the example. `only old` / `only new` list the arguments one side passes; `(missing)` marks an old path that isn’t on disk.',
    '',
    ...details(rows, input.exists),
  ].join('\n');
}

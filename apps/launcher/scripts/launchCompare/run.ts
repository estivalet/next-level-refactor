// Compares what NextLevelOS and the rebuild would run for every launch variant of every system and
// writes docs/04-quality/launch-comparison.md. Dev-only; reads NextLevelOS and the rebuild's data
// folder, writes only the report (and a temp file in the data folder's temp\).
//
//   npm run compare-launch -w apps/launcher -- [--nextlevelos <dir>] [--data <dir>] [--out <file>] [--python <exe>]
import { migrate } from '../../src/main/settings/migrate.ts';
import { systemCatalog } from '@nextlevel/system-catalog';
import { SettingsSchema, type LaunchOverride } from '@nextlevel/shared';
import Database from 'better-sqlite3';
import { execFileSync } from 'node:child_process';
import { existsSync, mkdirSync, readFileSync, rmSync, writeFileSync } from 'node:fs';
import { dirname, join, resolve, win32 } from 'node:path';
import { parseArgs } from 'node:util';
import { classify, normalize, type Placeholders } from './compare.ts';
import { newCommand, type LibraryGame, type NewBuilt } from './newCommand.ts';
import {
  brokenParts,
  LAUNCH_FIELDS,
  oldCommandLine,
  parseCommandLine,
  sampleVariants,
  text,
  type OldGame,
  type OldLauncher,
} from './oldCommand.ts';
import { renderReport, type OldBuilt, type Row } from './report.ts';

const here = import.meta.dirname;
const repo = resolve(here, '../../../..');

const { values } = parseArgs({
  options: {
    nextlevelos: { type: 'string', default: resolve(repo, '../NextLevelOS') },
    data: { type: 'string', default: join(repo, '.nextlevel-dev') },
    out: { type: 'string', default: join(repo, 'docs/04-quality/launch-comparison.md') },
    python: { type: 'string', default: 'python' },
  },
});
const publicDir = join(values.nextlevelos, 'public');
const dataDir = values.data;

/** Parses a JSON file; a UTF-8 byte-order mark (Notepad, PowerShell 5) is dropped first. */
function readJson(path: string): unknown {
  const content = readFileSync(path, 'utf8');
  return JSON.parse(content.charCodeAt(0) === 0xfeff ? content.slice(1) : content);
}

// As SettingsService.parseSettings (which plain Node can't load: parameter properties).
const migrated = migrate(readJson(join(dataDir, 'settings.json')));
if (migrated.kind !== 'ok') throw new Error('settings.json is from a newer launcher');
const settings = SettingsSchema.parse(migrated.value);

const config = readJson(join(publicDir, 'data/config.json')) as {
  storage: Array<{ path: string; priority: number }>;
};
const storagePaths = [...config.storage].sort((a, b) => a.priority - b.priority).map((s) => s.path);
const launchers = readJson(join(publicDir, 'data/launchers.json')) as Record<string, OldLauncher>;
const RUNNER = '<nextlevel-launcher>';

const catalog = systemCatalog();
const systemIdOf = (name: string) =>
  catalog.find((system) => system.aliases.includes(name) || system.name === name)?.id ?? null;

const library = new Database(join(dataDir, 'library.db'), { readonly: true, fileMustExist: true });
const findGame = library.prepare(
  `select g.location_id as locationId, o.profile_id as profileId, o.core as core,
     o.extra_args as extraArgs
   from games g left join game_launch_override o on o.game_id = g.id
   where g.system_id = ? and g.rel_path = ?`,
);
function libraryGame(systemId: string | null, relPath: string): LibraryGame | null {
  if (!systemId) return null;
  const row = findGame.get(systemId, relPath) as
    | {
        locationId: string | null;
        profileId: string | null;
        core: string | null;
        extraArgs: string | null;
      }
    | undefined;
  if (!row) return null;
  const override: LaunchOverride = {
    profileId: row.profileId,
    core: row.core,
    extraArgs: row.extraArgs ? (JSON.parse(row.extraArgs) as string[]) : [],
  };
  return { locationId: row.locationId, override };
}

/** The game's ROM and folder on every drive either launcher looks at, its emulator folder and names. */
function placeholdersFor(system: string, relPath: string, next: NewBuilt): Placeholders {
  const oldDirs = storagePaths.map((base) => win32.join(base, system));
  const rel = relPath.split('/');
  const roms = [
    ...oldDirs.map((dir) => win32.join(dir, ...rel)),
    ...(next.paths ? [next.paths.rom] : []),
  ];
  const dirs = [...oldDirs, ...(next.paths ? [next.paths.systemDir] : [])];
  const paths: Array<readonly [string, string]> = [
    ...roms.map((path) => [path, '{rom}'] as const),
    ...dirs.map((path) => [path, '{systemDir}'] as const),
    ...(next.paths ? [[next.paths.emulatorDir, '{emulatorDir}'] as const] : []),
  ];
  const file = rel.at(-1) ?? '';
  const stem = win32.extname(file) ? file.slice(0, -win32.extname(file).length) : file;
  return {
    paths: paths.sort(([a], [b]) => b.length - a.length),
    segments: [
      [system, '{system}'],
      [stem, '{romName}'],
    ],
  };
}

/** The copy NextLevelOS's runner starts (`_resolve_rom_path`: first drive with the file), if any. */
function oldRom(system: string, relPath: string): string | null {
  return (
    storagePaths
      .map((base) => win32.join(base, system, ...relPath.split('/')))
      .find((path) => existsSync(path)) ?? null
  );
}

interface Pending {
  row: Omit<Row, 'old' | 'outcome'>;
  old: OldBuilt | null;
  job: string[] | null;
}

const pending: Pending[] = [];
const noGamelist: string[] = [];
for (const system of Object.keys(launchers).sort((a, b) => a.localeCompare(b))) {
  const launcher = launchers[system] ?? {};
  const gamelist = join(publicDir, 'data/gamelists', `${system}.json`);
  if (!existsSync(gamelist)) {
    noGamelist.push(system);
    continue;
  }
  const games = ((readJson(gamelist) as { games?: OldGame[] }).games ?? []).filter(
    (g) => g.filename,
  );
  const systemId = systemIdOf(system);
  const def = catalog.find((s) => s.id === systemId);
  for (const { game, count } of sampleVariants(games)) {
    const filename = game.filename ?? '';
    const relPath = filename.replace(/^\.\//, '');
    const fields = Object.fromEntries(
      LAUNCH_FIELDS.flatMap((field) => {
        const value = text(game[field]);
        return value === '' ? [] : [[field, value]];
      }),
    );
    const next = newCommand({
      settings,
      system: def,
      systemId,
      relPath,
      game: libraryGame(systemId, relPath),
      exists: existsSync,
    });
    const copy = oldRom(system, relPath);
    if (copy && next.paths && normalize(copy) !== normalize(next.paths.rom)) {
      next.notes.push(`NextLevelOS starts the copy at ${copy}`);
    }
    const line = oldCommandLine(launcher, game, storagePaths, RUNNER, existsSync);
    const argv = parseCommandLine(line);
    const broken = brokenParts(line);
    const placeholders = placeholdersFor(system, relPath, next);
    const row = { system, systemId, sample: relPath, games: count, fields, next, placeholders };
    if (broken.length > 0 || argv.length === 0) {
      const error =
        argv.length === 0 ? 'no command' : `main.cjs leaves ${broken.join(', ')} in the command`;
      pending.push({
        row,
        job: null,
        old: { exe: null, args: [], cwd: null, env: {}, error, mounts: [] },
      });
    } else if (argv[0] === RUNNER) {
      pending.push({ row, job: argv.slice(1), old: null });
    } else {
      // main.cjs spawns these directly, from its own folder.
      const [exe = '', ...args] = argv;
      pending.push({
        row,
        job: null,
        old: { exe, args, cwd: publicDir, env: {}, error: null, mounts: [] },
      });
    }
  }
}
library.close();

// One Python run for every runner command.
const tempDir = join(dataDir, 'temp');
mkdirSync(tempDir, { recursive: true });
const jobsPath = join(tempDir, 'launch-compare-jobs.json');
const outPath = join(tempDir, 'launch-compare-out.json');
const jobs = pending.flatMap((p, id) => (p.job ? [{ id: String(id), argv: p.job }] : []));
writeFileSync(jobsPath, JSON.stringify(jobs));
try {
  execFileSync(
    values.python,
    [
      '-I',
      join(here, 'old_launcher_commands.py'),
      join(publicDir, 'nextlevel-launcher.py'),
      jobsPath,
      outPath,
    ],
    { stdio: 'inherit' },
  );
  const results = readJson(outPath) as Array<OldBuilt & { id: string }>;
  for (const { id, ...old } of results) {
    const entry = pending[Number(id)];
    if (entry) entry.old = old;
  }
} finally {
  rmSync(jobsPath, { force: true });
  rmSync(outPath, { force: true });
}

const rows: Row[] = pending.map(({ row, old }) => {
  const built = old ?? { exe: null, args: [], cwd: null, env: {}, error: 'no result', mounts: [] };
  return { ...row, old: built, outcome: classify(built, row.next, row.placeholders) };
});
mkdirSync(dirname(values.out), { recursive: true });
writeFileSync(
  values.out,
  renderReport({
    date: new Date().toISOString().slice(0, 10),
    nextLevelOS: values.nextlevelos,
    dataDir,
    rows,
    noGamelist,
    exists: existsSync,
  }),
);
console.log(`${String(rows.length)} variants compared → ${values.out}`);

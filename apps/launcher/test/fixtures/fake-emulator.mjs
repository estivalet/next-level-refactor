// A stand-in emulator for launch tests (test-strategy fixtures/fake-emulator). Run with node:
//   node fake-emulator.mjs --out <file> [--stderr <text>] [--ms <wait>] [--exit <code>] ...args
// Writes { argv, cwd, fake } as JSON to --out (argv = every argument after the script, unchanged),
// writes --stderr to stderr, waits --ms milliseconds, then exits with --exit (default 0).
import { writeFileSync } from 'node:fs';

const argv = process.argv.slice(2);
const option = (name) => {
  const index = argv.indexOf(name);
  return index >= 0 ? argv[index + 1] : undefined;
};

const out = option('--out');
if (out) {
  writeFileSync(
    out,
    JSON.stringify({ argv, cwd: process.cwd(), fake: process.env['NEXTLEVEL_FAKE'] ?? null }),
  );
}
const stderr = option('--stderr');
if (stderr) process.stderr.write(stderr);

setTimeout(
  () => {
    process.exit(Number(option('--exit') ?? 0));
  },
  Number(option('--ms') ?? 0),
);

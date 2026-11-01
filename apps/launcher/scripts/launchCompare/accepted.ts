import {
  classify,
  NO_PLACEHOLDERS,
  normalize,
  SAME_EFFECT,
  type Built,
  type Placeholders,
} from './compare.ts';

/**
 * A difference between NextLevelOS and the rebuild that is fine on purpose. With `rewriteOld`, a
 * row is accepted only when NextLevelOS's arguments, rewritten that way, then build the same
 * command (so a rule never hides another difference); without it, `applies` alone accepts.
 */
export interface AcceptedRule {
  id: string;
  /** Why it's fine, for the report. */
  reason: string;
  applies: (old: Built, next: Built) => boolean;
  rewriteOld?: (old: Built, next: Built) => Built;
}

const program = (built: Built) => built.exe?.split(/[\\/]/).pop()?.toLowerCase() ?? '';

export const ACCEPTED: readonly AcceptedRule[] = [
  {
    id: 'dolphin-batch',
    reason:
      'Dolphin: the rebuild passes `-b -e <game>` instead of `--exec=<game>`; `-b` closes Dolphin when the game stops, which a front-end wants.',
    applies: (_old, next) => program(next) === 'dolphin.exe',
    rewriteOld: (old) => ({
      ...old,
      args: old.args.flatMap((arg) =>
        arg.startsWith('--exec=') ? ['-b', '-e', arg.slice(7)] : [arg],
      ),
    }),
  },
  {
    id: 'mame-literal-commands',
    reason:
      'MAME autoboot: for a game without its own autoboot command NextLevelOS typed the literal text `%COMMANDS%` into the machine; the rebuild skips autoboot.',
    applies: (old) => old.args.includes('%COMMANDS%'),
    rewriteOld: (old) => ({
      ...old,
      args: old.args.filter((arg, i, args) => {
        if (arg === '-autoboot_delay') return args[i + 3] !== '%COMMANDS%';
        if (args[i - 1] === '-autoboot_delay') return args[i + 2] !== '%COMMANDS%';
        if (arg === '-autoboot_command') return args[i + 1] !== '%COMMANDS%';
        return !(arg === '%COMMANDS%' && args[i - 1] === '-autoboot_command');
      }),
    }),
  },
  {
    id: 'retroarch-core-none',
    reason:
      'NextLevelOS started RetroArch with the core `None.dll` (no core set for the system), so these games could not start there; the rebuild runs them with its own profile.',
    applies: (old) => old.args.some((arg) => /[\\/]none\.dll$/.test(normalize(arg))),
  },
  {
    id: 'same-emulator-other-copy',
    reason:
      'The same emulator from another folder: the copy chosen in Settings → Emulators (NextLevelOS had its path in the runner).',
    applies: (old, next) =>
      program(old) !== '' &&
      program(old) === program(next) &&
      normalize(old.exe ?? '') !== normalize(next.exe ?? ''),
    rewriteOld: (old, next) => ({ ...old, exe: next.exe }),
  },
];

/** The rule that accepts this difference, if any (rules in order). */
export function acceptedBy(
  old: Built,
  next: Built,
  placeholders: Placeholders = NO_PLACEHOLDERS,
  exists?: (path: string) => boolean,
): AcceptedRule | null {
  for (const rule of ACCEPTED) {
    if (!rule.applies(old, next)) continue;
    if (!rule.rewriteOld) return rule;
    const outcome = classify(rule.rewriteOld(old, next), next, placeholders, exists);
    if (SAME_EFFECT.has(outcome)) return rule;
  }
  return null;
}
